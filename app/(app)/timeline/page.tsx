import { Screen } from "@/app/components/AppShell";

export default function TimelinePage() {
  return (
    <Screen>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        TIMELINE
      </div>
      <h3 style={{ fontSize: 26, margin: "0 0 6px" }}>August 2026</h3>
      <p style={{ fontSize: 15, color: "var(--fg-3)" }}>
        Calendar and entry list land in step 4.
      </p>
    </Screen>
  );
}
