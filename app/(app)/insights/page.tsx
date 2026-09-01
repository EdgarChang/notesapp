import { Screen } from "@/app/components/AppShell";

export default function InsightsPage() {
  return (
    <Screen>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        WEEK OF AUG 24
      </div>
      <h3 style={{ fontSize: 26, margin: "0 0 6px" }}>
        What We&rsquo;re Learning
        <br />
        About You
      </h3>
      <p style={{ fontSize: 15, color: "var(--fg-3)" }}>
        Weekly note, mood chart and gratitude land in step 4.
      </p>
    </Screen>
  );
}
