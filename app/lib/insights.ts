import type { Mood } from "./entries";

/**
 * A weekly recap, mirroring the `weekly_notes` row that step 8's scheduled job
 * writes. Until that job exists no rows are produced, so Insights composes the
 * chart, people and quotes from entries directly and leaves the note itself
 * empty.
 */
export type WeeklyNote = {
  weekStart: string;
  /** Eyebrow label, e.g. "WEEK OF AUG 24". */
  weekLabel: string;
  note: string;
  /** What changed in the questions as a result. */
  whatChanged: string;
  /** Last 14 days, oldest first. */
  moodSeries: Mood[];
  /** Axis labels for the mood chart. */
  moodAxis: [string, string];
  topPeople: { name: string; count: number }[];
  gratitudeQuotes: { text: string; date: string }[];
};

/**
 * Which of the three mood colours a score maps to, on the 0-10 anchor scale.
 *
 * The thresholds moved with the scale. Left at the old 1-5 cut points, a 4 out
 * of 10 would have been coloured as a good day.
 */
export function moodTone(mood: Mood): "high" | "mid" | "low" {
  if (mood >= 7) return "high";
  if (mood >= 4) return "mid";
  return "low";
}

/** Bar height in px, scaled so a 10 fills the 90px track without overflowing. */
export function moodBarHeight(mood: Mood): number {
  return 18 + mood * 7;
}

