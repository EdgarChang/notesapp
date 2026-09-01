import Link from "next/link";
import { Screen } from "@/app/components/AppShell";
import { EntryCard } from "@/app/components/EntryCard";
import {
  daysInMonth,
  monthAndYear,
  monthKey,
  shiftMonth,
  todayIso,
} from "@/app/lib/entries";
import { getEntriesForMonth, getRecentEntries } from "@/app/lib/queries";
import { buildCalendar, countKept, DOW_LABELS } from "@/app/lib/timeline";
import styles from "../timeline.module.css";

export const dynamic = "force-dynamic";

/** `?m=YYYY-MM`, ignored unless it is a real month. */
function anchorFrom(month: string | undefined, today: string): string {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return today;
  return `${month}-01`;
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const today = todayIso();
  const { m } = await searchParams;
  const anchor = anchorFrom(m, today);

  const [monthEntries, recent] = await Promise.all([
    getEntriesForMonth(anchor),
    getRecentEntries(5),
  ]);

  const cells = buildCalendar(monthEntries, anchor, today);
  const kept = countKept(cells);
  const total = daysInMonth(anchor);
  const monthLabel = monthAndYear(anchor);

  const prevMonth = monthKey(shiftMonth(anchor, -1));
  // Nothing to look at ahead of the current month, so the arrow stops there.
  const nextMonth = monthKey(shiftMonth(anchor, 1));
  const canGoForward = nextMonth <= monthKey(today);

  return (
    <Screen>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Timeline
      </div>

      <div className={styles.head}>
        <div className={styles.monthNav}>
          <Link
            href={`/timeline?m=${prevMonth}`}
            className={styles.step}
            aria-label={`Previous month, ${monthAndYear(`${prevMonth}-01`)}`}
          >
            ‹
          </Link>
          <h3 className={styles.month}>{monthLabel}</h3>
          {canGoForward ? (
            <Link
              href={`/timeline?m=${nextMonth}`}
              className={styles.step}
              aria-label={`Next month, ${monthAndYear(`${nextMonth}-01`)}`}
            >
              ›
            </Link>
          ) : (
            <span className={`${styles.step} ${styles.stepOff}`} aria-hidden="true">
              ›
            </span>
          )}
        </div>
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

          const entryId = cell.kind === "empty" ? null : cell.entryId;

          if (entryId) {
            return (
              <Link
                key={i}
                href={`/entry/${entryId}`}
                className={`${styles.cell} ${tone} ${styles.linked}`}
                aria-label={`Entry for ${monthLabel} ${cell.day}`}
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

      {recent.length > 0 ? (
        <>
          <h4 className={styles.sectionTitle}>Recently Kept</h4>
          <div className={styles.entryList}>
            {recent.map((entry) => (
              <EntryCard key={entry.id} entry={entry} variant="roomy" />
            ))}
          </div>
        </>
      ) : (
        <p style={{ fontSize: 15, color: "var(--fg-3)" }}>
          Nothing kept yet. Your first check-in will show up here.
        </p>
      )}
    </Screen>
  );
}
