import Link from "next/link";
import { Screen } from "@/app/components/AppShell";
import { EntryCard } from "@/app/components/EntryCard";
import { shortDate, todayIso } from "@/app/lib/entries";
import { getHomeStats, getProfile, getRecentEntries, getWeeklyNote } from "@/app/lib/queries";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

const TONIGHT_QUESTION = {
  Playful: "So — what happened today?",
  Brief: "Ready when you are.",
} as const;

/**
 * The prototype hardcoded "Twelve days running". With a real streak the number
 * moves, and a new account starts at zero, which the design never shows.
 */
function streakLine(streakDays: number, keptToday: boolean): string {
  if (streakDays === 0) {
    return keptToday ? "First one kept. That's how it starts." : "Nothing kept yet. Tonight's a good place to start.";
  }
  const days = streakDays === 1 ? "One day" : `${streakDays} days`;
  return keptToday ? `${days} running. Today's kept.` : `${days} running. Today's still blank.`;
}

export default async function TodayPage() {
  const today = todayIso();
  const [profile, stats, recent, weekly] = await Promise.all([
    getProfile(),
    getHomeStats(today),
    getRecentEntries(3),
    getWeeklyNote(),
  ]);

  const name = profile?.displayName?.trim() || "there";
  const tone = profile?.assistantTone ?? "Playful";

  return (
    <Screen>
      <div className={styles.header}>
        <div className="eyebrow">KEEPSAKE</div>
        <div className={styles.todayLabel}>{shortDate(today)}</div>
      </div>

      <h3 className={styles.greeting}>Evening, {name}.</h3>
      <p className={styles.streakLine}>{streakLine(stats.streakDays, stats.keptToday)}</p>

      <section className={styles.hero}>
        <div className={styles.heroEyebrow}>
          {stats.keptToday ? "Today, kept" : "Tonight's check-in"}
        </div>
        <div className={styles.heroQuestion}>
          {stats.keptToday ? "That's today taken care of." : TONIGHT_QUESTION[tone]}
        </div>
        <div className={styles.heroMeta}>
          {stats.keptToday
            ? "Come back tomorrow evening."
            : // Not a fixed count any more: the prompt system picks two or
              // three specifics on top of the anchors, and a skipped one
              // shortens the night. The budget is the honest promise.
              "A few questions. Ninety seconds, tops."}
        </div>
        <Link href="/checkin" className={styles.heroCta}>
          {stats.keptToday ? "Look again" : "Start"}
        </Link>
      </section>

      <div className={styles.stats}>
        <div className={`${styles.stat} ${styles.statMango}`}>
          <div className={styles.statValue}>{stats.streakDays}</div>
          <div className={styles.statLabel}>day streak</div>
        </div>
        <div className={`${styles.stat} ${styles.statTeal}`}>
          <div className={styles.statValue}>{stats.entryCount}</div>
          <div className={styles.statLabel}>days kept</div>
        </div>
      </div>

      {recent.length > 0 ? (
        <>
          <div className={styles.sectionHead}>
            <h4 className={styles.sectionTitle}>This Week</h4>
            <Link href="/timeline" className={styles.seeAll}>
              See all &rarr;
            </Link>
          </div>
          <div className={styles.entryList}>
            {recent.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </>
      ) : null}

      {weekly ? (
        <Link href="/insights" className={styles.weekly}>
          <div className={styles.weeklyEyebrow}>Weekly note</div>
          <div className={styles.weeklyTeaser}>{weekly.note}</div>
          <div className={styles.weeklyCta}>Read the week &rarr;</div>
        </Link>
      ) : null}
    </Screen>
  );
}
