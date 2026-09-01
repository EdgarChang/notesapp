/**
 * Seeded data for the screens-first build. Lifted from the prototype's script
 * block, restructured to match the schema in the build plan so step 6 can swap
 * this module for real queries without touching the screens.
 */

/**
 * Anchor a001, 0 to 10, day-scoped Cantril Ladder.
 *
 * Was a 1-5 scale with word labels. The spec calls for 0-10 so the series is
 * comparable with national survey data, and the words are gone: a number the
 * writer chose is not improved by the app naming it for them.
 */
export type Mood = number;

/** Coarse label for a score, used only where a word reads better than a digit. */
export function moodLabel(mood: Mood): string {
  if (mood >= 8) return "A good one";
  if (mood >= 6) return "Steady";
  if (mood >= 4) return "Mixed";
  return "Hard";
}

export type Entry = {
  id: string;
  /** ISO date. One entry per user per day, enforced by unique (user_id, entry_date). */
  entryDate: string;
  /** Nullable: a check-in can be skipped past the mood question. */
  mood: Mood | null;
  title: string;
  summary: string;
  gratitude: string;
  tags: string[];
  hasPhoto: boolean;
  voiceDurationSeconds: number | null;
  /** Text of the entry from the same date a year earlier, if there is one. */
  lastYear: string | null;
  /** Derived from the id, so an entry keeps its colour for good. */
  tintIndex: 0 | 1 | 2 | 3 | 4;
};

/**
 * Stable tint for an entry. Derived from the id rather than array position, so
 * adding an entry never reshuffles the colours of the ones around it.
 */
export function tintIndexFor(id: string): 0 | 1 | 2 | 3 | 4 {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 100000;
  }
  return (hash % 5) as 0 | 1 | 2 | 3 | 4;
}

/* ---------- Date formatting ----------
   Deliberately built from the ISO string's own parts rather than the Date
   object. A journal entry's date is a calendar date, not an instant, so running
   it through Date/toLocaleDateString would let the server's timezone shift the
   label by a day. */

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function parts(isoDate: string): { y: number; m: number; d: number } {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Not an ISO date: ${isoDate}`);
  }
  return { y, m, d };
}

/** Zeller-style day index, 0 = Sunday. Avoids constructing a Date. */
export function dayOfWeek(isoDate: string): number {
  const { y, m, d } = parts(isoDate);
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yy = m < 3 ? y - 1 : y;
  return (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + (t[m - 1] ?? 0) + d) % 7;
}

/** "Sunday" */
export function weekdayName(isoDate: string): string {
  return WEEKDAYS[dayOfWeek(isoDate)] ?? "";
}

/** "August 30" */
export function longDate(isoDate: string): string {
  const { m, d } = parts(isoDate);
  return `${MONTHS[m - 1] ?? ""} ${d}`;
}

/** "Mon, Aug 31" */
export function shortDate(isoDate: string): string {
  const { m, d } = parts(isoDate);
  const weekday = (WEEKDAYS[dayOfWeek(isoDate)] ?? "").slice(0, 3);
  const month = (MONTHS[m - 1] ?? "").slice(0, 3);
  return `${weekday}, ${month} ${d}`;
}

/** Days in the month an ISO date falls in. */
export function daysInMonth(isoDate: string): number {
  const { y, m } = parts(isoDate);
  if (m === 2) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** "August 2026" */
export function monthAndYear(isoDate: string): string {
  const { y, m } = parts(isoDate);
  return `${MONTHS[m - 1] ?? ""} ${y}`;
}

/** "Aug 30" */
export function shortMonthDay(isoDate: string): string {
  const { m, d } = parts(isoDate);
  return `${(MONTHS[m - 1] ?? "").slice(0, 3)} ${d}`;
}

/** Day-of-month as a number, for calendar cells. */
export function dayOfMonth(isoDate: string): number {
  return parts(isoDate).d;
}

/** 19 -> "0:19" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Today as an ISO date, in the server's timezone.
 *
 * A journal day is a calendar day in the writer's own timezone, which we do not
 * store yet. Until profiles carries a timezone, someone journalling late at
 * night from a different zone than the server can see the date roll early.
 */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Same calendar date, one year earlier. */
export function oneYearBefore(isoDate: string): string {
  const { y, m, d } = parts(isoDate);
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
