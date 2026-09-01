import { Screen } from "@/app/components/AppShell";

export default function TodayPage() {
  return (
    <Screen>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        KEEPSAKE
      </div>
      <h3 style={{ fontSize: 26, margin: "0 0 6px" }}>Today</h3>
      <p style={{ fontSize: 15, color: "var(--fg-3)" }}>
        Home screen lands in step 2.
      </p>
    </Screen>
  );
}
