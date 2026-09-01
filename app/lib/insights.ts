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

/** Which of the three mood colours a value maps to. */
export function moodTone(mood: Mood): "high" | "mid" | "low" {
  if (mood >= 4) return "high";
  if (mood >= 3) return "mid";
  return "low";
}

/**
 * Bar height in px. Matches the prototype's `18 + value * 15`, so a 5 reaches
 * 93px in a 90px track and deliberately overshoots the top by 3px.
 */
export function moodBarHeight(mood: Mood): number {
  return 18 + mood * 15;
}

/** Progress bar width for a person, relative to the most-named. */
export function personShare(count: number, people: { count: number }[]): number {
  const max = Math.max(...people.map((p) => p.count));
  return max === 0 ? 0 : (count / max) * 100;
}
