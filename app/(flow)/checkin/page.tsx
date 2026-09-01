import { todayIso } from "@/app/lib/entries";
import { getProfile, getUser } from "@/app/lib/queries";
import { Checkin } from "./Checkin";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const [profile, user] = await Promise.all([getProfile(), getUser()]);

  // Stable per person per night, so the question order holds for the whole
  // check-in but differs from yesterday's.
  const seed = `${user?.id ?? "anon"}-${todayIso()}`;

  return <Checkin tone={profile?.assistantTone ?? "Playful"} seed={seed} />;
}
