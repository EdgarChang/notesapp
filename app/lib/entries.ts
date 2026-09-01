/**
 * Seeded data for the screens-first build. Lifted from the prototype's script
 * block, restructured to match the schema in the build plan so step 6 can swap
 * this module for real queries without touching the screens.
 */

/** Stored as smallint 1-5. Labels live here, not in the database. */
export type Mood = 1 | 2 | 3 | 4 | 5;

export const MOOD_LABELS: Record<Mood, string> = {
  1: "Rough",
  2: "Meh",
  3: "Steady",
  4: "Good",
  5: "Great",
};

export type Entry = {
  id: string;
  /** ISO date. One entry per user per day, enforced by unique (user_id, entry_date). */
  entryDate: string;
  mood: Mood;
  title: string;
  summary: string;
  gratitude: string;
  tags: string[];
  hasPhoto: boolean;
  voiceDurationSeconds: number | null;
  /** Text of the entry from the same date a year earlier, if there is one. */
  lastYear: string | null;
  /**
   * Which of the five thumbnail tints this entry uses. Explicit rather than
   * derived, because the prototype assigned tints at authoring time and index
   * position is not stable once entries come from a database.
   */
  tintIndex: 0 | 1 | 2 | 3 | 4;
};

export const ENTRIES: Entry[] = [
  {
    id: "a30",
    entryDate: "2026-08-30",
    mood: 4,
    title: "Long walk, no phone. Called Mum.",
    summary:
      "Walked the loop by the reservoir with the phone in my bag. Called Mum on the way back and she talked about the garden for twenty minutes. Made too much pasta, ate it anyway.",
    gratitude: "Mum picking up on the first ring.",
    tags: ["Mum", "Outside", "Slow day"],
    hasPhoto: true,
    voiceDurationSeconds: 19,
    lastYear:
      "Aug 30, 2025 — First week in the new place. You wrote that the boxes could wait.",
    tintIndex: 0,
  },
  {
    id: "a29",
    entryDate: "2026-08-29",
    mood: 5,
    title: "Maya’s birthday dinner at the loud place.",
    summary:
      "Maya’s birthday. The place was far too loud and nobody minded. Sam did the toast and got halfway through before losing it. Home at one, ears ringing.",
    gratitude: "Old friends who still show up.",
    tags: ["Maya", "Friends"],
    hasPhoto: true,
    voiceDurationSeconds: null,
    lastYear:
      "Aug 29, 2025 — A quiet one. You said you needed more nights like the loud ones.",
    tintIndex: 1,
  },
  {
    id: "a28",
    entryDate: "2026-08-28",
    mood: 2,
    title: "Release slipped. Fixed it by six.",
    summary:
      "Release slipped in the morning and the afternoon went to finding out why. Fixed by six. Went home instead of staying to admire it.",
    gratitude: "Priya staying on the call.",
    tags: ["Work"],
    hasPhoto: false,
    voiceDurationSeconds: 8,
    lastYear:
      "Aug 28, 2025 — Same week, same kind of day. You noted you did not sleep.",
    tintIndex: 2,
  },
  {
    id: "a27",
    entryDate: "2026-08-27",
    mood: 3,
    title: "Early swim. Quiet inbox.",
    summary:
      "Swam before work for the first time in months. The inbox stayed quiet until three, which felt suspicious but I took it.",
    gratitude: "An empty lane at 6:30am.",
    tags: ["Outside", "Work"],
    hasPhoto: true,
    voiceDurationSeconds: null,
    lastYear: "Aug 27, 2025 — You wrote about wanting a morning routine that sticks.",
    tintIndex: 3,
  },
  {
    id: "a26",
    entryDate: "2026-08-26",
    mood: 4,
    title: "Sam moved into the new flat.",
    summary:
      "Helped Sam shift boxes up four flights. He has one chair and enormous optimism. Ordered pizza on the floor.",
    gratitude: "Sam finally getting his own place.",
    tags: ["Sam", "Friends"],
    hasPhoto: true,
    voiceDurationSeconds: 22,
    lastYear: "Aug 26, 2025 — You and Sam were still talking about him moving out.",
    tintIndex: 4,
  },
];

/** Stands in for the `profiles` row plus derived streak counts. */
export const PROFILE = {
  displayName: "Edgar",
  /** "Playful" or "Brief". Surfaced as an onboarding setting in step 5. */
  assistantTone: "Playful" as "Playful" | "Brief",
  /** Today, per the prototype. Fixed so the seeded screens stay deterministic. */
  today: "2026-08-31",
  streakDays: 12,
  entryCount: 84,
  monthKept: 24,
  weeklyTeaser:
    "You write your best entries on the days you got outside first. Six of seven this week mentioned someone by name.",
};

export const TONIGHT_QUESTION: Record<typeof PROFILE.assistantTone, string> = {
  Playful: "So — what happened today?",
  Brief: "Ready when you are.",
};

export function getEntry(id: string): Entry | undefined {
  return ENTRIES.find((e) => e.id === id);
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

/** 19 -> "0:19" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
