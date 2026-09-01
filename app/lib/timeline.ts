import { dayOfMonth, dayOfWeek, daysInMonth, type Entry } from "./entries";

export const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export type CalendarCell =
  | { kind: "blank" }
  | { kind: "today"; day: number; entryId: string | null }
  | { kind: "kept"; day: number; entryId: string }
  | { kind: "empty"; day: number };

/**
 * The month grid for the month `today` falls in: leading blanks to line the 1st
 * up under its weekday, then one cell per day. Every kept day now has a real
 * entry behind it, so every kept cell is clickable.
 */
export function buildCalendar(entries: Entry[], today: string): CalendarCell[] {
  const todayDay = dayOfMonth(today);
  const month = today.slice(0, 7);
  const total = daysInMonth(today);
  const leadingBlanks = dayOfWeek(`${month}-01`);

  const entryByDay = new Map<number, string>();
  for (const entry of entries) {
    if (entry.entryDate.slice(0, 7) === month) {
      entryByDay.set(dayOfMonth(entry.entryDate), entry.id);
    }
  }

  const cells: CalendarCell[] = Array.from({ length: leadingBlanks }, () => ({
    kind: "blank" as const,
  }));

  for (let day = 1; day <= total; day++) {
    const entryId = entryByDay.get(day) ?? null;
    if (day === todayDay) {
      cells.push({ kind: "today", day, entryId });
    } else if (entryId) {
      cells.push({ kind: "kept", day, entryId });
    } else {
      cells.push({ kind: "empty", day });
    }
  }

  return cells;
}

/** Days kept this month, today included when it has an entry. */
export function countKept(cells: CalendarCell[]): number {
  return cells.filter(
    (c) => c.kind === "kept" || (c.kind === "today" && c.entryId !== null),
  ).length;
}
