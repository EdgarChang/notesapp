import type { Mood } from "./entries";

/**
 * Seeded weekly recap. Shaped to the `weekly_notes` table in the build plan, so
 * step 8's scheduled job can write these rows unchanged.
 *
 * `topPeople` and `gratitudeQuotes` are stored rather than derived. They span a
 * longer window than the five seeded entries, and the quotes are a curated pick
 * (the model chooses them), not simply the most recent three.
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

export const WEEKLY_NOTE: WeeklyNote = {
  weekStart: "2026-08-24",
  weekLabel: "Week of Aug 24",
  note: "Your good days start outside. Every entry you rated Good or Great this week began with something before 9am — a swim, a walk, a run.",
  whatChanged:
    "So we’ve moved the morning question earlier and dropped the one about screen time. You never answered it.",
  moodSeries: [3, 2, 4, 3, 1, 3, 4, 2, 3, 5, 4, 2, 4, 4],
  moodAxis: ["Aug 18", "Aug 31"],
  topPeople: [
    { name: "Maya", count: 9 },
    { name: "Sam", count: 6 },
    { name: "Priya", count: 4 },
    { name: "Mum", count: 3 },
  ],
  gratitudeQuotes: [
    { text: "Mum picking up on the first ring.", date: "Aug 30" },
    { text: "Old friends who still show up.", date: "Aug 29" },
    { text: "An empty lane at 6:30am.", date: "Aug 27" },
  ],
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
