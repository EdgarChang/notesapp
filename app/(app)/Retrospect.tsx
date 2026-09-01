"use client";

import { useState, useTransition } from "react";
import { generateRetrospect, loadRetrospect } from "@/app/lib/actions";
import { longDate, weekdayName } from "@/app/lib/entries";
import {
  describeRange,
  isValidRange,
  RANGE_LABELS,
  resolveRange,
  type RangePreset,
  type Retrospect as RetrospectData,
} from "@/app/lib/retrospect";
import styles from "./retrospect.module.css";

const PRESETS: RangePreset[] = ["week", "month", "year", "custom"];

export function Retrospect({
  today,
  initial,
}: {
  today: string;
  /** This week's, already loaded on the server when one was stored. */
  initial: RetrospectData | null;
}) {
  const [preset, setPreset] = useState<RangePreset>("week");
  const [custom, setCustom] = useState({ start: today, end: today });
  const [data, setData] = useState<RetrospectData | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const range =
    preset === "custom"
      ? { start: custom.start, end: custom.end }
      : resolveRange(preset, today);

  const rangeValid = isValidRange(range.start, range.end);
  /** The shown retrospect belongs to the selected range. */
  const showing =
    data && data.rangeStart === range.start && data.rangeEnd === range.end
      ? data
      : null;

  const choose = (next: RangePreset) => {
    setPreset(next);
    setError(null);
    if (next === "custom") return;
    const r = resolveRange(next, today);
    // Show a stored one straight away; never generate without being asked.
    startTransition(async () => {
      const found = await loadRetrospect(r.start, r.end);
      setData(found);
    });
  };

  const look = () => {
    if (!rangeValid) return;
    setError(null);
    startTransition(async () => {
      const result = await generateRetrospect(range.start, range.end);
      if (result.ok) {
        setData(result.retrospect);
        return;
      }
      setData(null);
      setError(
        result.reason === "empty"
          ? "Nothing kept in this stretch yet."
          : result.reason === "range"
            ? "That range runs backwards."
            : "Could not put this together just now. Try again in a moment.",
      );
    });
  };

  return (
    <section className={styles.root}>
      <h4 className={styles.title}>Look back</h4>

      <div className={styles.presets} role="group" aria-label="Range">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`${styles.preset} ${p === preset ? styles.presetOn : ""}`}
            aria-pressed={p === preset}
            onClick={() => choose(p)}
          >
            {RANGE_LABELS[p]}
          </button>
        ))}
      </div>

      {preset === "custom" ? (
        <div className={styles.customRow}>
          <label className={styles.dateField}>
            <span className={styles.dateLabel}>From</span>
            <input
              type="date"
              className={styles.date}
              value={custom.start}
              max={today}
              onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
            />
          </label>
          <label className={styles.dateField}>
            <span className={styles.dateLabel}>To</span>
            <input
              type="date"
              className={styles.date}
              value={custom.end}
              max={today}
              onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
            />
          </label>
        </div>
      ) : null}

      <div className={styles.rangeLine}>
        {rangeValid ? describeRange(range.start, range.end) : "That range runs backwards."}
      </div>

      {showing ? (
        <>
          <p className={styles.headline}>{showing.headline}</p>
          {showing.narrative.split(/\n{2,}/).map((para, i) => (
            <p key={i} className={styles.narrative}>
              {para}
            </p>
          ))}

          {showing.moments.length > 0 ? (
            <ol className={styles.moments}>
              {showing.moments.map((m) => (
                <li key={`${m.date}-${m.what}`} className={styles.moment}>
                  <div className={styles.momentDate}>
                    {weekdayName(m.date)}, {longDate(m.date)}
                  </div>
                  <div className={styles.momentWhat}>{m.what}</div>
                  <div className={styles.momentWhy}>{m.why}</div>
                </li>
              ))}
            </ol>
          ) : null}

          <button
            type="button"
            className={styles.again}
            disabled={pending}
            onClick={look}
          >
            {pending ? "Reading back…" : "Look again"}
          </button>
        </>
      ) : (
        <>
          {error ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : null}
          <button
            type="button"
            className={styles.cta}
            disabled={pending || !rangeValid}
            onClick={look}
          >
            {pending ? "Reading back…" : "Look back over this stretch"}
          </button>
        </>
      )}
    </section>
  );
}
