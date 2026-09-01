"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { draftToday, nextQuestion, saveCheckin, type PromptAnswer } from "@/app/lib/actions";
import { buildSteps, TIMING, type Step } from "@/app/lib/checkin";
import type { Selection } from "@/app/lib/selection";
import styles from "./checkin.module.css";

type Message =
  | { id: number; from: "bot"; kind: "text"; text: string }
  | { id: number; from: "user"; kind: "text"; text: string };

type Draft = {
  title: string;
  summary: string;
  tags: string[];
  people: string[];
  usedModel: boolean;
  verbatim: boolean;
};

const SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function Checkin({
  selection,
  knownPeople,
}: {
  selection: Selection;
  /** Names from recent entries, offered as taps on the people anchor. */
  knownPeople: string[];
}) {
  const router = useRouter();
  const steps = useMemo(() => buildSteps(selection), [selection]);

  const [index, setIndex] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [inputText, setInputText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** a001 on 0-10, the trend line. */
  const [mood, setMood] = useState<number | null>(null);
  const [anchors, setAnchors] = useState<Record<string, string>>({});
  /** Each answer carries the question as asked, which is also what the model needs. */
  const [answers, setAnswers] = useState<PromptAnswer[]>([]);

  const [activeStep, setActiveStep] = useState<Step | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const draftRequested = useRef(false);
  const askedRef = useRef<string[]>([]);
  const lastAnswerRef = useRef<string | null>(null);
  const answersRef = useRef(answers);
  const anchorsRef = useRef(anchors);
  const moodRef = useRef<number | null>(null);
  useEffect(() => {
    answersRef.current = answers;
    anchorsRef.current = anchors;
    moodRef.current = mood;
  }, [answers, anchors, mood]);

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

  const push = useCallback((message: Omit<Message, "id">) => {
    setMessages((prev) => [...prev, { ...message, id: nextId.current++ }]);
  }, []);

  /** Everything answered so far, as context for the reply and the draft. */
  const contextAnswers = useCallback(
    () => ({
      mood: moodRef.current,
      worthwhile: anchorsRef.current["a003"]
        ? Number(anchorsRef.current["a003"])
        : null,
      feeling: anchorsRef.current["a002"] ?? null,
      people: (anchorsRef.current["a004"] ?? "")
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean),
      responses: answersRef.current
        .filter((a) => a.value)
        .map((a) => ({
          question: a.question,
          answer: a.value as string,
          responseType: a.responseType,
        })),
    }),
    [],
  );

  const askAt = useCallback(
    (i: number) => {
      const base = steps[i];
      if (!base) return;

      setTyping(true);
      setActiveStep(null);
      const startedAt = Date.now();

      void nextQuestion(
        base,
        contextAnswers(),
        askedRef.current,
        lastAnswerRef.current,
        "",
      ).then(({ step, acknowledgement }) => {
        const show = () => {
          setTyping(false);
          setActiveStep(step);
          askedRef.current = [...askedRef.current, step.prompt.text];
          push({ from: "bot", kind: "text", text: step.prompt.text });
        };

        if (!acknowledgement) {
          later(show, Math.max(0, TIMING.typing - (Date.now() - startedAt)));
          return;
        }

        later(
          () => {
            setTyping(false);
            push({ from: "bot", kind: "text", text: acknowledgement });
            later(() => setTyping(true), TIMING.ack);
            later(show, TIMING.ack + TIMING.typing);
          },
          Math.max(0, TIMING.ack - (Date.now() - startedAt)),
        );
      });
    },
    [steps, contextAnswers, push, later],
  );

  useEffect(() => {
    const t = setTimeout(() => askAt(0), TIMING.open);
    return () => clearTimeout(t);
  }, [askAt]);

  const current = activeStep ?? steps[index];
  const dockStep = !typing && activeStep !== null ? current : undefined;
  const atSummary = index >= steps.length;

  /** Record the answer, post it, and move on. `value` null means skipped. */
  const answer = useCallback(
    (value: string | null) => {
      const step = steps[index];
      if (!step) return;
      const { prompt, isAnchor } = step;

      if (value !== null) {
        push({ from: "user", kind: "text", text: value });
        lastAnswerRef.current = value;
      } else {
        lastAnswerRef.current = null;
      }

      if (isAnchor) {
        if (prompt.response_type === "scale_0_10" && prompt.id === "a001") {
          setMood(value === null ? null : Number(value));
        }
        if (value !== null) {
          setAnchors((a) => ({ ...a, [prompt.id]: value }));
        }
      } else {
        setAnswers((a) => [
          ...a,
          {
            promptId: prompt.id,
            // As asked, which the picker may have reworded.
            question: (activeStep ?? step).prompt.text,
            responseType: prompt.response_type,
            value,
          },
        ]);
      }

      setInputText("");
      setPicked([]);
      const next = index + 1;
      setIndex(next);
      if (next < steps.length) {
        askAt(next);
        return;
      }

      // The closing screen is not a prompt, but it still needs announcing: the
      // textarea was appearing with nothing said about it.
      setActiveStep(null);
      setTyping(true);
      later(() => {
        setTyping(false);
        push({
          from: "bot",
          kind: "text",
          text: "Here's your day. Change anything I got wrong, then keep it.",
        });
      }, TIMING.typing);
    },
    [index, steps, activeStep, push, askAt, later],
  );

  // Draft once the questions are done.
  useEffect(() => {
    if (!atSummary || draftRequested.current) return;
    draftRequested.current = true;
    setDrafting(true);

    draftToday(contextAnswers())
      .then(({ draft: d, usedModel, verbatim }) => {
        setSummary(d.summary);
        setDraft({ ...d, usedModel, verbatim });
      })
      .catch(() => setDraft(null))
      .finally(() => setDrafting(false));
  }, [atSummary, contextAnswers]);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const keepDay = async () => {
    if (saving || drafting) return;
    setSaving(true);
    setSaveError(null);

    const namesAnchor = anchors["a004"] ?? "";
    const people = [
      ...new Set([
        ...(draft?.people ?? []),
        ...namesAnchor.split(",").map((n) => n.trim()).filter(Boolean),
      ]),
    ];

    const result = await saveCheckin({
      mood,
      anchors,
      promptAnswers: answers,
      title: draft?.title ?? null,
      summary,
      summaryDraft: draft?.summary ?? "",
      gratitude: null,
      tags: (draft?.tags ?? []).slice(0, 4),
      people,
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

  const total = steps.length + 1;
  const progress = Math.round((index / total) * 100);
  const counter = `${Math.min(index + 1, total)}/${total}`;
  const kind = dockStep?.prompt.response_type;

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
        {messages.map((m) => (
          <div
            key={m.id}
            className={`${styles.row} ks-animate-in ${
              m.from === "bot" ? styles.fromBot : styles.fromUser
            }`}
          >
            <div
              className={`${styles.bubble} ${
                m.from === "bot" ? styles.bubbleBot : styles.bubbleUser
              }`}
            >
              {m.text}
            </div>
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
        {kind === "scale_0_10" ? (
          <div className={styles.scale} role="group" aria-label={dockStep?.prompt.text}>
            {SCALE.map((n) => (
              <button
                key={n}
                type="button"
                className={styles.scaleButton}
                onClick={() => answer(String(n))}
              >
                {n}
              </button>
            ))}
          </div>
        ) : null}

        {kind === "people_picker" ? (
          <div>
            {knownPeople.length > 0 ? (
              <div className={styles.suggestions}>
                {knownPeople.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`${styles.suggestion} ${
                      picked.includes(name) ? styles.suggestionOn : ""
                    }`}
                    aria-pressed={picked.includes(name)}
                    onClick={() =>
                      setPicked((p) =>
                        p.includes(name) ? p.filter((x) => x !== name) : [...p, name],
                      )
                    }
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className={styles.textRow}>
              <input
                className={styles.input}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={dockStep?.placeholder ?? "Names, separated by commas"}
                aria-label={dockStep?.prompt.text}
              />
              <button
                type="button"
                className={styles.send}
                aria-label="Send"
                onClick={() => {
                  const typed = inputText
                    .split(",")
                    .map((n) => n.trim())
                    .filter(Boolean);
                  const all = [...new Set([...picked, ...typed])];
                  answer(all.length ? all.join(", ") : null);
                }}
              >
                &rarr;
              </button>
            </div>
            <button type="button" className={styles.skip} onClick={() => answer(null)}>
              Nobody today
            </button>
          </div>
        ) : null}

        {kind === "single_word" || kind === "short_text" || kind === "long_text" ? (
          <div>
            <div className={styles.textRow}>
              {kind === "long_text" ? (
                <textarea
                  className={styles.multiline}
                  rows={3}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={dockStep?.placeholder ?? "Type your answer"}
                  aria-label={dockStep?.prompt.text}
                />
              ) : (
                <input
                  className={styles.input}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && inputText.trim()) answer(inputText.trim());
                  }}
                  placeholder={dockStep?.placeholder ?? "Type your answer"}
                  aria-label={dockStep?.prompt.text}
                />
              )}
              <button
                type="button"
                className={styles.send}
                disabled={!inputText.trim()}
                aria-label="Send"
                onClick={() => answer(inputText.trim())}
              >
                &rarr;
              </button>
            </div>
            {!dockStep?.isAnchor ? (
              <button type="button" className={styles.skip} onClick={() => answer(null)}>
                Skip this one
              </button>
            ) : null}
          </div>
        ) : null}

        {atSummary ? (
          <div className={styles.summaryDock}>
            <textarea
              className={styles.textarea}
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={drafting ? "" : "Write the day in a line or two"}
              disabled={drafting}
              aria-label="Your day"
            />
            {drafting ? (
              <div className={styles.draftNote}>Putting the day together&hellip;</div>
            ) : draft?.verbatim ? (
              <div className={styles.draftNote}>
                Your own words are at the end, exactly as you wrote them.
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
