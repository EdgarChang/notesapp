import Link from "next/link";
import { longDate, type Entry } from "@/app/lib/entries";
import styles from "./EntryCard.module.css";

/**
 * One row in an entry list. `compact` is Home's "This Week"; `roomy` is
 * Timeline's "Recently Kept", which uses a larger thumbnail and wraps the title.
 */
export function EntryCard({
  entry,
  variant = "compact",
}: {
  entry: Entry;
  variant?: "compact" | "roomy";
}) {
  return (
    <Link
      href={`/entry/${entry.id}`}
      className={`${styles.card} ${styles[variant]}`}
    >
      <div
        className={styles.thumb}
        style={{ background: `var(--tint-cycle-${entry.tintIndex})` }}
        aria-hidden="true"
      />
      <div className={styles.text}>
        <div className={styles.meta}>
          {longDate(entry.entryDate)}
          {entry.mood !== null ? ` · ${entry.mood}/10` : ""}
        </div>
        <div className={styles.title}>{entry.title}</div>
      </div>
    </Link>
  );
}
