"use server";

import { revalidatePath } from "next/cache";
import { todayIso } from "./entries";
import type { ScriptStep } from "./checkin";
import {
  composeFallbackDraft,
  draftDay,
  extractMentions,
  pickNextQuestion,
  writeRetrospect,
  type CheckinAnswers,
  type DayDraft,
} from "./llm";
import { describeRange, isValidRange, type Retrospect } from "./retrospect";
import {
  getEntriesInRange,
  getPickerContext,
  getRetrospect,
  rangeFingerprint,
} from "./queries";
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
  /** Names mentioned, stored on the entry so counts can be derived from it. */
  people: string[];
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

  // Anything typed into the summary box after drafting was never seen by the
  // extraction pass. Re-read the kept text when it differs, so a name added at
  // the last step still counts. Unedited summaries skip the call.
  let people = input.people;
  let tags = input.tags;
  if (input.summary.trim() && input.summary.trim() !== input.summaryDraft.trim()) {
    const found = await extractMentions(input.summary);
    if (found) {
      people = [...new Set([...people, ...found.people])];
      tags = [...new Set([...tags, ...found.tags])].slice(0, 4);
    }
  }

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
        tags,
        people,
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


/* ---------------------------------------------------------------------------
 * Looking back
 * ------------------------------------------------------------------------- */

export type RetrospectResult =
  | { ok: true; retrospect: Retrospect }
  | { ok: false; reason: "empty" | "failed" | "range" };

/**
 * Write and store a look back over a range.
 *
 * Returns a cached one when the entries have not changed since it was made,
 * because this is the most expensive call in the app and the answer only moves
 * when the entries do.
 */
export async function generateRetrospect(
  start: string,
  end: string,
): Promise<RetrospectResult> {
  if (!isValidRange(start, end)) return { ok: false, reason: "range" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "failed" };

  const cached = await getRetrospect(start, end);
  if (cached) return { ok: true, retrospect: cached };

  const entries = await getEntriesInRange(start, end);
  if (entries.length === 0) return { ok: false, reason: "empty" };

  const written = await writeRetrospect(entries, describeRange(start, end));
  if (!written) return { ok: false, reason: "failed" };

  const retrospect: Retrospect = {
    rangeStart: start,
    rangeEnd: end,
    ...written,
  };

  const { error } = await supabase.from("retrospects").upsert(
    {
      user_id: user.id,
      range_start: start,
      range_end: end,
      fingerprint: await rangeFingerprint(start, end),
      headline: retrospect.headline,
      narrative: retrospect.narrative,
      moments: retrospect.moments,
    },
    { onConflict: "user_id,range_start,range_end" },
  );
  // A failed write costs a regeneration next time, not the result in hand.
  if (error) console.error("[actions] generateRetrospect store:", error.message);

  return { ok: true, retrospect };
}

/** Load a stored retrospect without generating one. */
export async function loadRetrospect(
  start: string,
  end: string,
): Promise<Retrospect | null> {
  if (!isValidRange(start, end)) return null;
  return getRetrospect(start, end);
}
