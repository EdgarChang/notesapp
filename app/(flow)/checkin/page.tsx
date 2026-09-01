import { PROFILE } from "@/app/lib/entries";
import { Checkin } from "./Checkin";

export default function CheckinPage() {
  return <Checkin tone={PROFILE.assistantTone} />;
}
