import "server-only";
import {
  dayOfWeek,
  daysInMonth,
  oneYearBefore,
  shortMonthDay,
  tintIndexFor,
  todayIso,
  type Entry,
  type Mood,
} from "./entries";
import type { WeeklyNote } from "./insights";
import { createClient } from "./supabase/server";

/** Columns selected for an entry. Keep in step with `toEntry`. */
const ENTRY_COLUMNS =
  "id, entry_date, mood, title, summary, summary_draft, gratitude, tags, photo_key, voice_duration_seconds";

/**
 * Log a failed query instead of letting `?? []` turn it into an empty result.
 *
 * A silent empty array is indistinguishable from "no data yet", which is how an
 * invalid date bound once made a whole month read as unkept.
 */
function failed(label: string, error: { message: string } | null): void {
  if (error) console.error(`[queries] ${label}: ${error.message}`);
}

type EntryRow = {
  id: string;
  entry_date: string;
  mood: number | null;
  title: string | null;
  summary: string | null;
  summary_draft: string | null;
  gratitude: string | null;
  tags: string[] | null;
  photo_key: string | null;
  voice_duration_seconds: number | null;
};

/**
 * Database row to the shape the screens already render. `lastYear` is filled in
 * separately by getEntry, since it needs its own lookup.
 */
function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    mood: (row.mood ?? null) as Mood | null,
    title: row.title ?? "Untitled day",
    // Prefer what the user kept; fall back to the model's draft.
    summary: row.summary ?? row.summary_draft ?? "",
    gratitude: row.gratitude ?? "",
    tags: row.tags ?? [],
    hasPhoto: row.photo_key !== null,
    voiceDurationSeconds: row.voice_duration_seconds,
    lastYear: null,
    tintIndex: tintIndexFor(row.id),
  };
}

/** The signed-in user, or null. Screens above the middleware can assume non-null. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export type Profile = {
  displayName: string | null;
  assistantTone: "Playful" | "Brief";
  reminderTime: string | null;
  onboardedAt: string | null;
};

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, assistant_tone, reminder_time, onboarded_at")
    .maybeSingle();
  failed("getProfile", error);

  if (!data) return null;
  return {
    displayName: data.display_name,
    assistantTone: data.assistant_tone === "Brief" ? "Brief" : "Playful",
    reminderTime: data.reminder_time,
    onboardedAt: data.onboarded_at,
  };
}

/** Most recent entries, newest first. */
export async function getRecentEntries(limit = 5): Promise<Entry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select(ENTRY_COLUMNS)
    .order("entry_date", { ascending: false })
    .limit(limit);
  failed("getRecentEntries", error);
  return (data ?? []).map(toEntry);
}

/**
 * Every entry in the calendar month containing `isoDate`.
 *
 * The upper bound is the real last day of the month. A hardcoded 31 asks
 * Postgres for dates like 2026-09-31, which is not a date: the query fails with
 * 22008 and the month silently reads as empty.
 */
export async function getEntriesForMonth(isoDate: string): Promise<Entry[]> {
  const month = isoDate.slice(0, 7);
  const lastDay = String(daysInMonth(isoDate)).padStart(2, "0");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select(ENTRY_COLUMNS)
    .gte("entry_date", `${month}-01`)
    .lte("entry_date", `${month}-${lastDay}`)
    .order("entry_date", { ascending: false });
  failed("getEntriesForMonth", error);
  return (data ?? []).map(toEntry);
}

/** One entry by id, with its "one year ago" line resolved. */
export async function getEntry(id: string): Promise<Entry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select(ENTRY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  failed("getEntry", error);

  if (!data) return null;
  const entry = toEntry(data);

  const { data: lastYear } = await supabase
    .from("entries")
    .select("entry_date, summary, summary_draft")
    .eq("entry_date", oneYearBefore(entry.entryDate))
    .maybeSingle();

  if (lastYear) {
    const text = lastYear.summary ?? lastYear.summary_draft ?? "";
    entry.lastYear = `${shortMonthDay(lastYear.entry_date)}, ${lastYear.entry_date.slice(0, 4)} — ${text}`;
  }

  return entry;
}

export async function getEntryByDate(isoDate: string): Promise<Entry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select(ENTRY_COLUMNS)
    .eq("entry_date", isoDate)
    .maybeSingle();
  failed("getEntryByDate", error);
  return data ? toEntry(data) : null;
}

export type HomeStats = {
  streakDays: number;
  entryCount: number;
  keptToday: boolean;
};

/**
 * Streak and totals, computed from the entry dates.
 *
 * A streak survives today being blank: it is still "twelve days running" at
 * 8pm before you have written anything. So counting starts from today if today
 * is kept, otherwise from yesterday.
 */
export async function getHomeStats(today = todayIso()): Promise<HomeStats> {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("entries")
    .select("entry_date", { count: "exact" })
    .order("entry_date", { ascending: false })
    .limit(400);
  failed("getHomeStats", error);

  const dates = new Set((data ?? []).map((r) => r.entry_date));
  const keptToday = dates.has(today);

  let streakDays = 0;
  const cursor = new Date(`${today}T00:00:00Z`);
  if (!keptToday) cursor.setUTCDate(cursor.getUTCDate() - 1);

  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streakDays++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return { streakDays, entryCount: count ?? dates.size, keptToday };
}

/** The most recent weekly note, or null before the first one is generated. */
export async function getWeeklyNote(): Promise<WeeklyNote | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_notes")
    .select("week_start, note, what_changed, mood_series, top_people, gratitude_quotes")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  failed("getWeeklyNote", error);

  if (!data) return null;
  return {
    weekStart: data.week_start,
    weekLabel: `Week of ${shortMonthDay(data.week_start)}`,
    note: data.note,
    whatChanged: data.what_changed ?? "",
    moodSeries: (data.mood_series ?? []) as Mood[],
    moodAxis: ["", ""],
    topPeople: (data.top_people ?? []) as { name: string; count: number }[],
    gratitudeQuotes: (data.gratitude_quotes ?? []) as { text: string; date: string }[],
  };
}

/**
 * Mood for the last `days` days, oldest first, one slot per day.
 *
 * Missing days are null rather than zero: a day you did not write is not a mood
 * of zero, and averaging one in would be a lie. Keeping the slot rather than
 * dropping it also holds the chart's geometry steady, so a single entry renders
 * as one thin bar in its right position instead of stretching to fill the width.
 */
export async function getMoodSeries(
  days = 14,
  today = todayIso(),
): Promise<{ series: (Mood | null)[]; axis: [string, string] }> {
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startIso = start.toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select("entry_date, mood")
    .gte("entry_date", startIso)
    .lte("entry_date", today)
    .order("entry_date", { ascending: true });
  failed("getMoodSeries", error);

  const byDate = new Map<string, Mood | null>();
  for (const row of data ?? []) {
    byDate.set(row.entry_date, (row.mood ?? null) as Mood | null);
  }

  const series: (Mood | null)[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < days; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    series.push(byDate.get(iso) ?? null);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { series, axis: [shortMonthDay(startIso), shortMonthDay(today)] };
}

/**
 * Names mentioned most often, counted across entries.
 *
 * Derived rather than accumulated. A stored tally could not survive a day being
 * revised or an entry being deleted, and had already drifted to a count of
 * three from a single entry.
 */
export async function getTopPeople(
  limit = 4,
): Promise<{ name: string; count: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select("people")
    .not("people", "eq", "{}");
  failed("getTopPeople", error);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    // One mention per entry per person: naming someone twice in a day is still
    // one day you thought about them.
    for (const name of new Set((row.people ?? []) as string[])) {
      const key = name.trim();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Recent gratitude lines, newest first, for the Insights card. */
export async function getGratitudeQuotes(
  limit = 3,
): Promise<{ text: string; date: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select("entry_date, gratitude")
    .not("gratitude", "is", null)
    .neq("gratitude", "")
    .order("entry_date", { ascending: false })
    .limit(limit);
  failed("getGratitudeQuotes", error);

  return (data ?? []).map((r) => ({
    text: r.gratitude as string,
    date: shortMonthDay(r.entry_date),
  }));
}

/** Leading blanks so the 1st lines up under its weekday. */
export function leadingBlanksFor(isoDate: string): number {
  return dayOfWeek(`${isoDate.slice(0, 8)}01`);
}


/** History the question picker uses to personalise a step. */
export async function getPickerContext(): Promise<{
  focusTopics: string[];
  recentTitles: string[];
  recurringPeople: string[];
}> {
  const supabase = await createClient();

  const [{ data: profile }, { data: recent }, people] = await Promise.all([
    supabase.from("question_profiles").select("focus_topics").maybeSingle(),
    supabase
      .from("entries")
      .select("title")
      .not("title", "is", null)
      .order("entry_date", { ascending: false })
      .limit(5),
    getTopPeople(5),
  ]);

  return {
    focusTopics: (profile?.focus_topics ?? []) as string[],
    recentTitles: (recent ?? []).map((r) => r.title as string),
    recurringPeople: people.map((p) => p.name),
  };
}
