"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { draftToday, nextQuestion, saveCheckin } from "@/app/lib/actions";
import {
  buildScript,
  CANNED_PHOTO_CAPTION,
  TIMING,
  type AssistantTone,
  type ScriptStep,
} from "@/app/lib/checkin";
import { MOOD_LABELS, type Mood } from "@/app/lib/entries";
import styles from "./checkin.module.css";

type Message =
  | { id: number; from: "bot"; kind: "text"; text: string; adaptiveNote?: string }
  | { id: number; from: "user"; kind: "text"; text: string }
  | { id: number; from: "user"; kind: "photo"; caption: string };

/** Plain Omit collapses a union to its shared keys, so distribute over it. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** A message before the list assigns it an id. */
type NewMessage = DistributiveOmit<Message, "id">;

type Answers = {
  mood: Mood | null;
  highlight: string | null;
  outside: boolean | null;
  gratitude: string | null;
  /** Their own account of the day. Kept verbatim as the summary. */
  open: string | null;
};

type Draft = {
  title: string;
  /**
   * The summary exactly as drafted, kept separate from the editable `summary`
   * state so summary_draft records what was offered rather than what was kept.
   * Comparing the two is the only honest signal for how much people rewrite.
   */
  summary: string;
  tags: string[];
  people: string[];
  /** False when the plainly composed fallback was used. */
  usedModel: boolean;
  /** True when the summary is the user's own words, untouched. */
  verbatim: boolean;
};

export function Checkin({
  tone,
  seed,
  showAdaptiveNotes = true,
}: {
  tone: AssistantTone;
  /** Stable per person per night; fixes tonight's question order. */
  seed: string;
  showAdaptiveNotes?: boolean;
}) {
  const router = useRouter();
  const script = useMemo(() => buildScript(tone, seed), [tone, seed]);

  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  /** The text input buffer for a text step. */
  const [inputText, setInputText] = useState("");
  /** The editable summary shown on the last step. */
  const [summary, setSummary] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Answers>({
    mood: null,
    highlight: null,
    outside: null,
    gratitude: null,
    open: null,
  });

  /**
   * The step as asked. The picker may reword the question, the chips and the
   * adaptive note, so the dock has to render this rather than the written
   * script. Null while the next question is still being fetched.
   */
  const [activeStep, setActiveStep] = useState<ScriptStep | null>(null);

  /** Lets askAt read the latest answers without becoming a changing dependency. */
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  /** Questions already asked tonight, so the picker does not reuse a framing. */
  const askedRef = useRef<string[]>([]);
  /** The answer just given, which the reply should respond to. */
  const lastAnswerRef = useRef<string | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Guards against drafting twice if the last step is re-entered. */
  const draftRequested = useRef(false);

  /** setTimeout that is cancelled if the screen unmounts mid-sequence. */
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.length = 0;
    };
  }, []);

  const push = useCallback((message: NewMessage) => {
    setMessages((prev) => [...prev, { ...message, id: nextId.current++ }]);
  }, []);

  /**
   * Reply to the last answer, then ask question `index`.
   *
   * One request produces both, since the model needs the same context for each:
   * what they just said, and what the next step is for. The sequence mirrors a
   * person replying — a short reaction, a beat, then the question — so the
   * typing indicator runs twice rather than covering one fixed delay.
   *
   * nextQuestion always resolves, falling back to the written step and its
   * written acknowledgement, so a slow or failed call never stalls the check-in.
   */
  const askAt = useCallback(
    (index: number) => {
      const base = script[index];
      if (!base) return;

      setTyping(true);
      setActiveStep(null);
      const startedAt = Date.now();

      void nextQuestion(
        base,
        answersRef.current,
        askedRef.current,
        lastAnswerRef.current,
        // The written reply belongs to the step just answered.
        script[index - 1]?.ack ?? "",
      ).then(
        ({ step, acknowledgement }) => {
          const showQuestion = () => {
            setTyping(false);
            setActiveStep(step);
            askedRef.current = [...askedRef.current, step.question];
            push({
              from: "bot",
              kind: "text",
              text: step.question,
              ...(showAdaptiveNotes && step.adaptiveNote
                ? { adaptiveNote: step.adaptiveNote }
                : {}),
            });
          };

          // Nothing to reply to: hold the indicator to its floor so a fast
          // response does not flash past, then ask.
          if (!acknowledgement) {
            later(showQuestion, Math.max(0, TIMING.typing - (Date.now() - startedAt)));
            return;
          }

          later(
            () => {
              setTyping(false);
              push({ from: "bot", kind: "text", text: acknowledgement });
              // A beat, then the assistant starts typing the question.
              later(() => setTyping(true), TIMING.ack);
              later(showQuestion, TIMING.ack + TIMING.typing);
            },
            Math.max(0, TIMING.ack - (Date.now() - startedAt)),
          );
        },
      );
    },
    [script, showAdaptiveNotes, push, later],
  );

  // Open with the first question once the screen has painted.
  useEffect(() => {
    const t = setTimeout(() => askAt(0), TIMING.open);
    return () => clearTimeout(t);
  }, [askAt]);

  /**
   * Post the answer and move on. The reply to it comes back from askAt with the
   * next question, so this no longer pushes a written acknowledgement itself.
   */
  const advance = useCallback(
    (answer: NewMessage | null) => {
      if (answer) push(answer);
      lastAnswerRef.current =
        answer && answer.kind === "text"
          ? answer.text
          : answer?.kind === "photo"
            ? "added a photo"
            : null;
      const next = step + 1;
      setStep(next);
      setInputText("");
      askAt(next);
    },
    [step, push, askAt],
  );

  // The step as asked, falling back to the written one before it arrives.
  const current = activeStep ?? script[step];
  /**
   * Controls appear only once the question has actually been asked.
   *
   * Previously the dock switched the instant `step` incremented, so a fast
   * tapper could answer a question before seeing it, and with the picker in
   * play the chip labels would visibly change under them.
   */
  const dockStep = !typing && activeStep !== null ? current : undefined;

  /**
   * Fetch the draft as soon as the summary step is reached, so the textarea is
   * usually filled by the time the question finishes typing out.
   */
  useEffect(() => {
    if (current?.field !== "summary" || draftRequested.current) return;
    draftRequested.current = true;
    setDrafting(true);

    draftToday(answers)
      .then(({ draft: d, usedModel, verbatim }) => {
        setSummary(d.summary);
        setDraft({
          title: d.title,
          summary: d.summary,
          tags: d.tags,
          people: d.people,
          usedModel,
          verbatim,
        });
      })
      .catch((error) => {
        console.error("[checkin] draftToday failed:", error);
        setSummary("");
        setDraft(null);
      })
      .finally(() => setDrafting(false));
  }, [current?.field, answers]);

  const answerText = (text: string) => {
    if (!current) return;

    switch (current.field) {
      case "mood": {
        const mood = (Object.keys(MOOD_LABELS) as unknown as Mood[]).find(
          (m) => MOOD_LABELS[m] === text,
        );
        setAnswers((a) => ({ ...a, mood: mood ?? null }));
        break;
      }
      case "highlight":
        setAnswers((a) => ({ ...a, highlight: text }));
        break;
      case "outside":
        setAnswers((a) => ({ ...a, outside: text === "Yep" }));
        break;
      case "gratitude":
        setAnswers((a) => ({ ...a, gratitude: text }));
        break;
      case "open":
        setAnswers((a) => ({ ...a, open: text }));
        break;
      default:
        break;
    }

    advance({ from: "user", kind: "text", text });
  };

  const sendInput = () => {
    const text = inputText.trim();
    if (!text || !current) return;
    answerText(text);
  };

  const addPhoto = () => {
    advance({ from: "user", kind: "photo", caption: CANNED_PHOTO_CAPTION });
  };

  const skip = () => advance(null);

  const keepDay = async () => {
    if (saving || drafting) return;
    setSaving(true);
    setSaveError(null);

    const tags = [...new Set([...(draft?.tags ?? []), ...(answers.outside ? ["Outside"] : [])])];

    const result = await saveCheckin({
      mood: answers.mood,
      title: draft?.title ?? answers.highlight,
      summary,
      summaryDraft: draft?.summary ?? "",
      gratitude: answers.gratitude,
      tags: tags.slice(0, 4),
      people: draft?.people ?? [],
      voiceDurationSeconds: null,
    });

    if (!result.ok) {
      setSaveError(result.error);
      setSaving(false);
      return;
    }

    router.refresh();
    router.push(`/entry/${result.id}`);
  };

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const progress = Math.round((step / script.length) * 100);
  const counter = `${Math.min(step + 1, script.length)}/${script.length}`;

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/" className={styles.close}>
          Close
        </Link>
        <div
          className={styles.track}
          role="progressbar"
          aria-label="Check-in progress"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={styles.fill} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.counter}>{counter}</div>
      </header>

      <div className={styles.chat} ref={chatRef} role="log" aria-live="polite">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.row} ks-animate-in ${
              message.from === "bot" ? styles.fromBot : styles.fromUser
            }`}
          >
            {message.from === "bot" && message.adaptiveNote ? (
              <div className={styles.adaptiveNote}>{message.adaptiveNote}</div>
            ) : null}

            {message.kind === "text" ? (
              <div
                className={`${styles.bubble} ${
                  message.from === "bot" ? styles.bubbleBot : styles.bubbleUser
                }`}
              >
                {message.text}
              </div>
            ) : null}

            {message.kind === "photo" ? (
              <div className={styles.photoCard}>
                <div className={styles.photoArea}>
                  <span className={styles.photoTag}>photo placeholder</span>
                </div>
                <div className={styles.photoCaption}>{message.caption}</div>
              </div>
            ) : null}
          </div>
        ))}

        {typing ? (
          <div className={styles.typing} aria-label="Assistant is typing">
            <div className={`${styles.dot} ks-animate-dot`} />
            <div className={`${styles.dot} ks-animate-dot`} />
            <div className={`${styles.dot} ks-animate-dot`} />
          </div>
        ) : null}
      </div>

      <div className={styles.dock}>
        {dockStep?.kind === "chips" ? (
          <div className={styles.chips}>
            {dockStep.chips?.map((label) => (
              <button
                key={label}
                type="button"
                className={styles.chip}
                onClick={() => answerText(label)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {dockStep?.kind === "text" ? (
          <div>
            {dockStep.chips?.length ? (
              <div className={styles.suggestions}>
                {dockStep.chips.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={styles.suggestion}
                    onClick={() => answerText(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className={styles.textRow}>
              {dockStep.multiline ? (
                <textarea
                  className={styles.multiline}
                  rows={3}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter makes a new line here; the send button submits.
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendInput();
                  }}
                  placeholder={dockStep.placeholder ?? "Type your answer"}
                  aria-label={dockStep.question}
                />
              ) : (
                <input
                  className={styles.input}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendInput();
                  }}
                  placeholder={dockStep.placeholder ?? "Type your answer"}
                  aria-label={dockStep.question}
                />
              )}
              <button
                type="button"
                className={styles.send}
                onClick={sendInput}
                disabled={!inputText.trim()}
                aria-label="Send"
              >
                &rarr;
              </button>
            </div>
            {dockStep.field === "gratitude" || dockStep.field === "open" ? (
              <button type="button" className={styles.skip} onClick={skip}>
                Skip this one
              </button>
            ) : null}
          </div>
        ) : null}

        {dockStep?.kind === "yesno" ? (
          <div className={styles.yesno}>
            <button
              type="button"
              className={styles.no}
              onClick={() => answerText("Nope")}
            >
              Nope
            </button>
            <button
              type="button"
              className={styles.yes}
              onClick={() => answerText("Yep")}
            >
              Yep
            </button>
          </div>
        ) : null}

        {dockStep?.kind === "photo" ? (
          <div className={styles.photoDock}>
            <div className={styles.photoRow}>
              <button type="button" className={styles.photoOutline} onClick={addPhoto}>
                Take one
              </button>
              <button type="button" className={styles.photoPrimary} onClick={addPhoto}>
                From camera roll
              </button>
            </div>
            <button type="button" className={styles.skip} onClick={skip}>
              No photo today
            </button>
          </div>
        ) : null}

        {dockStep?.kind === "summary" ? (
          <div className={styles.summaryDock}>
            <textarea
              className={styles.textarea}
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={drafting ? "" : "Write the day in a line or two"}
              disabled={drafting}
              aria-label="Your day in three lines"
            />
            {drafting ? (
              <div className={styles.draftNote}>Writing your day&hellip;</div>
            ) : draft?.verbatim ? (
              <div className={styles.draftNote}>
                Your own words are at the end, exactly as you wrote them.
              </div>
            ) : draft && !draft.usedModel ? (
              <div className={styles.draftNote}>
                Put together from your answers. Edit it into your own words.
              </div>
            ) : null}
            {saveError ? (
              <div className={styles.saveError} role="alert">
                {saveError}
              </div>
            ) : null}
            <button
              type="button"
              className={styles.keep}
              disabled={saving || drafting}
              onClick={keepDay}
            >
              {saving ? "Keeping…" : "Keep this day"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
