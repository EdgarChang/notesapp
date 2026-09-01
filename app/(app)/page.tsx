import Link from "next/link";
import { Screen } from "@/app/components/AppShell";
import { EntryCard } from "@/app/components/EntryCard";
import { ENTRIES, PROFILE, shortDate, TONIGHT_QUESTION } from "@/app/lib/entries";
import styles from "./home.module.css";

export default function TodayPage() {
  const recent = ENTRIES.slice(0, 3);

  return (
    <Screen>
      <div className={styles.header}>
        <div className="eyebrow">KEEPSAKE</div>
        <div className={styles.todayLabel}>{shortDate(PROFILE.today)}</div>
      </div>

      <h3 className={styles.greeting}>Evening, {PROFILE.displayName}.</h3>
      <p className={styles.streakLine}>
        Twelve days running. Today&rsquo;s still blank.
      </p>

      <section className={styles.hero}>
        <div className={styles.heroEyebrow}>Tonight&rsquo;s check-in</div>
        <div className={styles.heroQuestion}>
          {TONIGHT_QUESTION[PROFILE.assistantTone]}
        </div>
        <div className={styles.heroMeta}>Six quick ones. About a minute.</div>
        <Link href="/checkin" className={styles.heroCta}>
          Start
        </Link>
      </section>

      <div className={styles.stats}>
        <div className={`${styles.stat} ${styles.statMango}`}>
          <div className={styles.statValue}>{PROFILE.streakDays}</div>
          <div className={styles.statLabel}>day streak</div>
        </div>
        <div className={`${styles.stat} ${styles.statTeal}`}>
          <div className={styles.statValue}>{PROFILE.entryCount}</div>
          <div className={styles.statLabel}>days kept</div>
        </div>
      </div>

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

      <Link href="/insights" className={styles.weekly}>
        <div className={styles.weeklyEyebrow}>Weekly note</div>
        <div className={styles.weeklyTeaser}>{PROFILE.weeklyTeaser}</div>
        <div className={styles.weeklyCta}>Read the week &rarr;</div>
      </Link>
    </Screen>
  );
}
