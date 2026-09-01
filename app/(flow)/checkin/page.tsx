import { todayIso } from "@/app/lib/entries";
import { getProfile, getSelectionContext, getUser } from "@/app/lib/queries";
import { selectPrompts } from "@/app/lib/selection";
import { Checkin } from "./Checkin";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const today = todayIso();
  const [profile, user, context] = await Promise.all([
    getProfile(),
    getUser(),
    getSelectionContext(today),
  ]);

  const selection = selectPrompts({
    today,
    oftenSkipped: context.oftenSkipped,
    weeklyDay: profile?.weeklyPromptDay ?? 0,
    monthlyDue: context.monthlyDue,
    entryCount: context.entryCount,
    // Stable per person per night, so the set holds for the whole check-in.
    seed: `${user?.id ?? "anon"}-${today}`,
  });

  return <Checkin selection={selection} knownPeople={context.knownPeople} />;
}
