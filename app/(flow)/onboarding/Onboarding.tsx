"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  FOCUS_OPTIONS,
  ONBOARDING_DEFAULTS,
  ONBOARDING_STEPS,
  REMINDER_OPTIONS,
  type FocusTopic,
} from "@/app/lib/onboarding";
import styles from "./onboarding.module.css";

export function Onboarding() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<FocusTopic[]>(ONBOARDING_DEFAULTS.focus);
  const [reminder, setReminder] = useState(ONBOARDING_DEFAULTS.reminderLabel);

  const isLast = step === ONBOARDING_STEPS - 1;

  const toggleTopic = (topic: FocusTopic) => {
    setFocus((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  };

  const next = () => {
    if (isLast) {
      // Nothing persists yet. Step 6 writes profiles.display_name,
      // profiles.reminder_time and question_profiles.focus_topics here.
      router.push("/");
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <div className={styles.root}>
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Setup progress"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={ONBOARDING_STEPS}
      >
        {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
          <div
            key={i}
            className={`${styles.segment} ${i <= step ? styles.segmentDone : ""}`}
          />
        ))}
      </div>

      {step === 0 ? (
        <div className={styles.step}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            Keepsake
          </div>
          <h2 className={styles.display}>
            Days Go Fast.
            <br />
            Keep A Few.
          </h2>
          <p className={styles.lede}>
            A minute a night. We ask, you answer, and the year stops being a blur.
          </p>
          <label className={styles.label} htmlFor="display-name">
            What should we call you?
          </label>
          <input
            id="display-name"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name"
            autoComplete="given-name"
          />
        </div>
      ) : null}

      {step === 1 ? (
        <div className={styles.step}>
          <h3 className={styles.stepTitle}>What&rsquo;s Worth Remembering?</h3>
          <p className={styles.stepLede}>
            Pick a few. The questions lean this way, then drift as we learn you.
          </p>
          <div className={styles.topics}>
            {FOCUS_OPTIONS.map((topic) => {
              const on = focus.includes(topic);
              return (
                <button
                  key={topic}
                  type="button"
                  className={`${styles.topic} ${on ? styles.topicOn : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleTopic(topic)}
                >
                  {topic}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className={styles.step}>
          <h3 className={styles.stepTitle}>When Should We Ask?</h3>
          <p className={styles.stepLede}>
            One nudge a day. Miss it and we&rsquo;ll catch you tomorrow, no guilt
            trip.
          </p>
          <div className={styles.times}>
            {REMINDER_OPTIONS.map((option) => {
              const on = reminder === option.label;
              return (
                <button
                  key={option.label}
                  type="button"
                  className={`${styles.time} ${on ? styles.timeOn : ""}`}
                  aria-pressed={on}
                  onClick={() => setReminder(option.label)}
                >
                  <span>{option.label}</span>
                  <span className={styles.timeHint}>{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <button type="button" className={styles.cta} onClick={next}>
        {isLast ? "Let’s keep today" : "Next"}
      </button>
    </div>
  );
}
