"use server";

import { revalidatePath } from "next/cache";
import { todayIso } from "./entries";
import type { ScriptStep } from "./checkin";
import {
  composeFallbackDraft,
  draftDay,
  pickNextQuestion,
  type CheckinAnswers,
  type DayDraft,
} from "./llm";
import { getPickerContext } from "./queries";
import { createClient } from "./supabase/server";

export type CheckinInput = {
  mood: number | null;
  title: string | null;
  /** What the user kept after editing. */
  summary: string;
  /** What was drafted for them, kept so we can measure how much gets rewritten. */
  summaryDraft: string;
  gratitude: string | null;
  tags: string[];
  voiceDurationSeconds: number | null;
};

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Write today's entry.
 *
 * Upserts on (user_id, entry_date) because that pair is unique: doing the
 * check-in twice in one evening should revise the day, not fail on a constraint.
 *
 * user_id comes from the verified session rather than the client, so a caller
 * cannot write an entry onto someone else's account. The RLS `with check`
 * policy enforces the same thing at the database, which is what makes this
 * safe rather than merely correct.
 */
export async function saveCheckin(input: CheckinInput): Promise<SaveResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data, error } = await supabase
    .from("entries")
    .upsert(
      {
        user_id: user.id,
        entry_date: todayIso(),
        mood: input.mood,
        title: input.title,
        summary: input.summary,
        summary_draft: input.summaryDraft,
        gratitude: input.gratitude,
        tags: input.tags,
        voice_duration_seconds: input.voiceDurationSeconds,
      },
      { onConflict: "user_id,entry_date" },
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/timeline");
  revalidatePath("/insights");

  return { ok: true, id: data.id };
}


/**
 * Draft the day from the answers collected so far.
 *
 * Always resolves. `usedModel` tells the UI whether Claude wrote it or whether
 * this is the plainly composed version, so the copy can be honest about which
 * one the user is editing.
 */
export async function draftToday(
  answers: CheckinAnswers,
): Promise<{ draft: DayDraft; usedModel: boolean; verbatim: boolean }> {
  const own = answers.open?.trim();

  const drafted = await draftDay(answers);
  const base = drafted ?? composeFallbackDraft(answers);

  // Their own words are appended after the summary of everything else, never
  // folded into it. The prompt asks for this too, but the join is what
  // guarantees it: whatever the model returns, the user's text is added
  // unchanged and is the last thing in the entry.
  if (own) {
    const summary = [base.summary.trim(), own].filter(Boolean).join("\n\n");
    return {
      draft: { ...base, summary },
      usedModel: drafted !== null,
      verbatim: true,
    };
  }

  return { draft: base, usedModel: drafted !== null, verbatim: false };
}

/**
 * Record the names Claude found, so Insights' "Named Most Often" has something
 * to count. Merged rather than replaced, since counts accumulate across days.
 */
export async function recordPeople(names: string[]): Promise<void> {
  if (names.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from("question_profiles")
    .select("recurring_people")
    .maybeSingle();

  const counts = { ...((data?.recurring_people ?? {}) as Record<string, number>) };
  for (const name of names) {
    const key = name.trim();
    if (key) counts[key] = (counts[key] ?? 0) + 1;
  }

  const { error } = await supabase
    .from("question_profiles")
    .update({ recurring_people: counts })
    .eq("user_id", user.id);

  if (error) console.error("[actions] recordPeople:", error.message);
}


/**
 * Reply to what they just said, and reword the next step for this person.
 *
 * Always resolves to something usable, so the check-in never stalls waiting on
 * the model. Falls back to the written step and its written acknowledgement.
 */
export async function nextQuestion(
  step: ScriptStep,
  answers: CheckinAnswers,
  askedTonight: string[] = [],
  previousAnswer: string | null = null,
  /**
   * The written reply to fall back on. It belongs to the step just answered, not
   * the one being asked, so the caller supplies it: reading `step.ack` here
   * would acknowledge the wrong answer.
   */
  fallbackAck = "",
): Promise<{ step: ScriptStep; acknowledgement: string }> {
  const fallback = { step, acknowledgement: fallbackAck };
  try {
    const context = await getPickerContext();
    const picked = await pickNextQuestion(
      step,
      context,
      answers,
      askedTonight,
      previousAnswer,
    );
    return picked ?? fallback;
  } catch (error) {
    console.error("[actions] nextQuestion:", error);
    return fallback;
  }
}
