import { notFound } from "next/navigation";
import { Screen } from "@/app/components/AppShell";
import { getEntry, longDate, weekdayName } from "@/app/lib/entries";

/**
 * Placeholder. The full entry detail screen is step 4; this exists now so the
 * entry cards on Home are clickable during review rather than 404ing.
 */
export default async function EntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = getEntry(id);
  if (!entry) notFound();

  return (
    <Screen>
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        {weekdayName(entry.entryDate)}
      </div>
      <h3 style={{ fontSize: 30, margin: "0 0 18px" }}>
        {longDate(entry.entryDate)}
      </h3>
      <p style={{ fontSize: 15, color: "var(--fg-3)" }}>
        Entry detail lands in step 4.
      </p>
    </Screen>
  );
}
