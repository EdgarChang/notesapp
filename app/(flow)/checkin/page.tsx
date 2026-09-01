import { getProfile } from "@/app/lib/queries";
import { Checkin } from "./Checkin";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const profile = await getProfile();
  return <Checkin tone={profile?.assistantTone ?? "Playful"} />;
}
