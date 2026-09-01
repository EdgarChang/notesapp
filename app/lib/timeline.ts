import {
  dayOfMonth,
  dayOfWeek,
  daysInMonth,
  ENTRIES,
  PROFILE,
  type Entry,
} from "./entries";

export const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export type CalendarCell =
  | { kind: "blank" }
  | { kind: "today"; day: number }
  | { kind: "kept"; day: number; entryId: string | null }
  | { kind: "empty"; day: number };

/**
 * Days earlier in the month that were kept but have no seeded entry record, so
 * the calendar looks lived-in. The prototype generated these with a `d % 4`
 * trick; they are listed here so it is obvious they are filler. Step 6 replaces
 * this whole function with one query over `entries`.
 */
const ARCHIVE_KEPT_DAYS = [
  1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 19, 21, 22, 23, 25,
];

/**
 * The month grid for the month `PROFILE.today` falls in: leading blanks to line
 * the 1st up under its weekday, then one cell per day.
 */
export function buildCalendar(entries: Entry[] = ENTRIES): CalendarCell[] {
  const today = PROFILE.today;
  const todayDay = dayOfMonth(today);
  const total = daysInMonth(today);

  const firstOfMonth = `${today.slice(0, 8)}01`;
  const leadingBlanks = dayOfWeek(firstOfMonth);

  const entryByDay = new Map<number, string>();
  for (const entry of entries) {
    if (entry.entryDate.slice(0, 7) === today.slice(0, 7)) {
      entryByDay.set(dayOfMonth(entry.entryDate), entry.id);
    }
  }

  const cells: CalendarCell[] = Array.from({ length: leadingBlanks }, () => ({
    kind: "blank" as const,
  }));

  for (let day = 1; day <= total; day++) {
    if (day === todayDay) {
      cells.push({ kind: "today", day });
    } else if (entryByDay.has(day)) {
      cells.push({ kind: "kept", day, entryId: entryByDay.get(day) ?? null });
    } else if (ARCHIVE_KEPT_DAYS.includes(day)) {
      cells.push({ kind: "kept", day, entryId: null });
    } else {
      cells.push({ kind: "empty", day });
    }
  }

  return cells;
}

/** Days kept this month, excluding today, which is still blank. */
export function countKept(cells: CalendarCell[]): number {
  return cells.filter((c) => c.kind === "kept").length;
}
