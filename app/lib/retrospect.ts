import { dayOfWeek, daysInMonth, todayIso } from "./entries";

/** A noteworthy day the model chose to call out. */
export type Moment = {
  /** ISO date of the entry it came from. */
  date: string;
  what: string;
  /** Why it stood out among the rest. */
  why: string;
};

export type Retrospect = {
  rangeStart: string;
  rangeEnd: string;
  headline: string;
  narrative: string;
  moments: Moment[];
};

export type RangePreset = "week" | "month" | "year" | "custom";

export const RANGE_LABELS: Record<RangePreset, string> = {
  week: "This week",
  month: "This month",
  year: "This year",
  custom: "Custom",
};

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parts(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return { y: y as number, m: m as number, d: d as number };
}

/**
 * Calendar ranges ending today, not rolling windows: "this week" should mean
 * the week you are in, so the same range keeps its identity all week rather
 * than sliding a day each time you open it.
 */
export function resolveRange(
  preset: Exclude<RangePreset, "custom">,
  today = todayIso(),
): { start: string; end: string } {
  const { y, m, d } = parts(today);

  if (preset === "year") return { start: iso(y, 1, 1), end: today };
  if (preset === "month") return { start: iso(y, m, 1), end: today };

  // Week starts Sunday, matching the Timeline calendar's column order.
  const back = dayOfWeek(today);
  if (d - back >= 1) return { start: iso(y, m, d - back), end: today };

  // The week began in the previous month.
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  const prevLast = daysInMonth(iso(py, pm, 1));
  return { start: iso(py, pm, prevLast - (back - d)), end: today };
}

/** "30 August to 1 September 2026" */
export function describeRange(start: string, end: string): string {
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const a = parts(start);
  const b = parts(end);
  const left =
    a.y === b.y
      ? `${a.d} ${MONTHS[a.m - 1]}`
      : `${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
  return `${left} to ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
}

/** Guards a user-supplied custom range. */
export function isValidRange(start: string, end: string): boolean {
  const ok = /^\d{4}-\d{2}-\d{2}$/;
  return ok.test(start) && ok.test(end) && start <= end;
}
