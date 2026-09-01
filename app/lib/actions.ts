"use server";

import { revalidatePath } from "next/cache";
import { todayIso } from "./entries";
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
