import Link from "next/link";
import { Screen } from "@/app/components/AppShell";
import { EntryCard } from "@/app/components/EntryCard";
import { daysInMonth, ENTRIES, monthAndYear, PROFILE } from "@/app/lib/entries";
import { buildCalendar, countKept, DOW_LABELS } from "@/app/lib/timeline";
import styles from "../timeline.module.css";

export default function TimelinePage() {
  const cells = buildCalendar();
  const kept = countKept(cells);
  const total = daysInMonth(PROFILE.today);

  return (
    <Screen>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Timeline
      </div>

      <div className={styles.head}>
        <h3 className={styles.month}>{monthAndYear(PROFILE.today)}</h3>
        <div className={styles.kept}>
          {kept} of {total} kept
        </div>
      </div>

      <div className={styles.dow} aria-hidden="true">
        {DOW_LABELS.map((label, i) => (
          <div key={i} className={styles.dowLabel}>
            {label}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {cells.map((cell, i) => {
          if (cell.kind === "blank") {
            return <div key={i} className={`${styles.cell} ${styles.blank}`} />;
          }

          const tone =
            cell.kind === "today"
              ? styles.today
              : cell.kind === "kept"
                ? styles.keptCell
                : styles.empty;

          if (cell.kind === "kept" && cell.entryId) {
            return (
              <Link
                key={i}
                href={`/entry/${cell.entryId}`}
                className={`${styles.cell} ${tone} ${styles.linked}`}
                aria-label={`Entry for ${monthAndYear(PROFILE.today)} ${cell.day}`}
              >
                {cell.day}
              </Link>
            );
          }

          return (
            <div key={i} className={`${styles.cell} ${tone}`}>
              {cell.day}
            </div>
          );
        })}
      </div>

      <h4 className={styles.sectionTitle}>Recently Kept</h4>
      <div className={styles.entryList}>
        {ENTRIES.map((entry) => (
          <EntryCard key={entry.id} entry={entry} variant="roomy" />
        ))}
      </div>
    </Screen>
  );
}
