"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildScript,
  CANNED_PHOTO_CAPTION,
  CANNED_VOICE,
  DRAFT_SUMMARY,
  LIVE_BAR_COUNT,
  LIVE_BAR_STAGGER_MS,
  STATIC_BARS,
  TIMING,
  type AssistantTone,
} from "@/app/lib/checkin";
import { saveCheckin } from "@/app/lib/actions";
import { formatDuration, MOOD_LABELS, type Mood } from "@/app/lib/entries";
import styles from "./checkin.module.css";

type Message =
  | { id: number; from: "bot"; kind: "text"; text: string; adaptiveNote?: string }
  | { id: number; from: "user"; kind: "text"; text: string }
  | { id: number; from: "user"; kind: "voice"; transcript: string; durationSeconds: number }
  | { id: number; from: "user"; kind: "photo"; caption: string };

/** Plain Omit collapses a union to its shared keys, so distribute over it. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** A message before the list assigns it an id. */
type NewMessage = DistributiveOmit<Message, "id">;

export function Checkin({
  tone,
  showAdaptiveNotes = true,
}: {
  tone: AssistantTone;
  showAdaptiveNotes?: boolean;
}) {
  const router = useRouter();
  const script = useMemo(() => buildScript(tone), [tone]);

  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [summary, setSummary] = useState(DRAFT_SUMMARY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // What the six steps actually collected, for the row we write at the end.
  const [answers, setAnswers] = useState<{
    mood: Mood | null;
    title: string | null;
    gratitude: string | null;
    voiceDurationSeconds: number | null;
    tags: string[];
  }>({ mood: null, title: null, gratitude: null, voiceDurationSeconds: null, tags: [] });

  const chatRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  /** Assistant types, then asks question `index`. */
  const askAt = useCallback(
    (index: number) => {
      const next = script[index];
      if (!next) return;
      setTyping(true);
      later(() => {
        setTyping(false);
        push({
          from: "bot",
          kind: "text",
          text: next.question,
          ...(showAdaptiveNotes && next.adaptiveNote
            ? { adaptiveNote: next.adaptiveNote }
            : {}),
        });
      }, TIMING.typing);
    },
    [script, showAdaptiveNotes, push, later],
  );

  // Open with the first question once the screen has painted. askAt is stable
  // for a given script and tone, so this fires once per check-in.
  useEffect(() => {
    const t = setTimeout(() => askAt(0), TIMING.open);
    return () => clearTimeout(t);
  }, [askAt]);

  /**
   * Post the user's answer, acknowledge it, then ask the next question.
   * `answer` is null when the step was skipped, which also skips the ack.
   */
  const advance = useCallback(
    (answer: NewMessage | null, ack: string) => {
      if (answer) push(answer);
      const next = step + 1;
      setStep(next);
      setDraft("");
      if (ack) {
        later(() => push({ from: "bot", kind: "text", text: ack }), TIMING.ack);
      }
      later(() => askAt(next), ack ? TIMING.nextWithAck : TIMING.nextWithoutAck);
    },
    [step, push, later, askAt],
  );

  const current = script[step];

  const answerText = (text: string) => {
    if (!current) return;

    if (current.kind === "chips") {
      const mood = (Object.keys(MOOD_LABELS) as unknown as Mood[]).find(
        (m) => MOOD_LABELS[m] === text,
      );
      setAnswers((a) => ({ ...a, mood: mood ?? null }));
    } else if (current.kind === "text") {
      setAnswers((a) => ({ ...a, title: text }));
    } else if (current.kind === "yesno" && text === "Yep") {
      // The daylight question is the only yes/no in the script, and a yes is
      // worth keeping as a tag.
      setAnswers((a) => ({ ...a, tags: [...new Set([...a.tags, "Outside"])] }));
    }

    advance({ from: "user", kind: "text", text }, current.ack);
  };

  const sendDraft = () => {
    const text = draft.trim();
    if (!text || !current) return;
    answerText(text);
  };

  const toggleRecording = () => {
    if (!recording) {
      setRecording(true);
      return;
    }
    setRecording(false);
    setAnswers((a) => ({
      ...a,
      gratitude: CANNED_VOICE.transcript,
      voiceDurationSeconds: CANNED_VOICE.durationSeconds,
    }));
    advance(
      {
        from: "user",
        kind: "voice",
        transcript: CANNED_VOICE.transcript,
        durationSeconds: CANNED_VOICE.durationSeconds,
      },
      current?.ack ?? "",
    );
  };

  const addPhoto = () => {
    advance(
      { from: "user", kind: "photo", caption: CANNED_PHOTO_CAPTION },
      current?.ack ?? "",
    );
  };

  const skip = () => advance(null, "");

  // Keep the newest message in view, matching the prototype's
  // `el.scrollTop = el.scrollHeight` on every update.
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

            {message.kind === "voice" ? (
              <div className={`${styles.bubble} ${styles.bubbleUser}`}>
                <div className={styles.voiceHead}>
                  <div className={styles.play} aria-hidden="true">
                    &#9654;
                  </div>
                  <div className={styles.staticBars} aria-hidden="true">
                    {STATIC_BARS.map((height, i) => (
                      <div
                        key={i}
                        className={styles.staticBar}
                        style={{ height: `${height}px` }}
                      />
                    ))}
                  </div>
                  <div className={styles.voiceDuration}>
                    {formatDuration(message.durationSeconds)}
                  </div>
                </div>
                <div className={styles.voiceTranscript}>{message.transcript}</div>
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
        {current?.kind === "chips" ? (
          <div className={styles.chips}>
            {current.chips?.map((label) => (
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

        {current?.kind === "text" ? (
          <div>
            <div className={styles.suggestions}>
              {current.chips?.map((label) => (
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
            <div className={styles.textRow}>
              <input
                className={styles.input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendDraft();
                }}
                placeholder="Type it in a line or two"
                aria-label={current.question}
              />
              <button
                type="button"
                className={styles.send}
                onClick={sendDraft}
                disabled={!draft.trim()}
                aria-label="Send"
              >
                &rarr;
              </button>
            </div>
          </div>
        ) : null}

        {current?.kind === "yesno" ? (
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

        {current?.kind === "voice" ? (
          <div className={styles.voiceDock}>
            {recording ? (
              <div className={styles.liveBars} aria-hidden="true">
                {Array.from({ length: LIVE_BAR_COUNT }, (_, i) => (
                  <div
                    key={i}
                    className={`${styles.liveBar} ks-animate-bar`}
                    style={{ animationDelay: `${i * LIVE_BAR_STAGGER_MS}ms` }}
                  />
                ))}
              </div>
            ) : null}
            <button
              type="button"
              className={`${styles.record} ${recording ? styles.recording : ""}`}
              onClick={toggleRecording}
            >
              {recording ? "Stop and send" : "Hold to talk"}
            </button>
            <button type="button" className={styles.skip} onClick={skip}>
              Skip this one
            </button>
          </div>
        ) : null}

        {current?.kind === "photo" ? (
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

        {current?.kind === "summary" ? (
          <div className={styles.summaryDock}>
            <textarea
              className={styles.textarea}
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              aria-label="Your day in three lines"
            />
            {saveError ? (
              <div className={styles.saveError} role="alert">
                {saveError}
              </div>
            ) : null}
            <button
              type="button"
              className={styles.keep}
              disabled={saving}
              onClick={async () => {
                if (saving) return;
                setSaving(true);
                setSaveError(null);
                const result = await saveCheckin({
                  mood: answers.mood,
                  title: answers.title,
                  summary,
                  summaryDraft: DRAFT_SUMMARY,
                  gratitude: answers.gratitude,
                  tags: answers.tags,
                  voiceDurationSeconds: answers.voiceDurationSeconds,
                });
                if (!result.ok) {
                  setSaveError(result.error);
                  setSaving(false);
                  return;
                }
                router.refresh();
                router.push(`/entry/${result.id}`);
              }}
            >
              {saving ? "Keeping…" : "Keep this day"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
