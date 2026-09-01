import { Screen } from "@/app/components/AppShell";
import { createClient } from "@/app/lib/supabase/server";
import {
  moodBarHeight,
  moodTone,
  personShare,
  WEEKLY_NOTE,
} from "@/app/lib/insights";
import styles from "../insights.module.css";

const TONE_CLASS = {
  high: styles.moodHigh,
  mid: styles.moodMid,
  low: styles.moodLow,
} as const;

export default async function InsightsPage() {
  const { moodSeries, moodAxis, topPeople, gratitudeQuotes } = WEEKLY_NOTE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Screen>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        {WEEKLY_NOTE.weekLabel}
      </div>
      <h3 className={styles.heading}>
        What We&rsquo;re Learning
        <br />
        About You
      </h3>

      <section className={styles.statement}>
        <p className={styles.statementNote}>{WEEKLY_NOTE.note}</p>
        <div className={styles.statementChange}>{WEEKLY_NOTE.whatChanged}</div>
      </section>

      <section className={styles.panel}>
        <h4 className={styles.panelTitle}>Mood, Last 14 Days</h4>
        <div className={styles.chart}>
          {moodSeries.map((mood, i) => (
            <div
              key={i}
              className={`${styles.moodBar} ${TONE_CLASS[moodTone(mood)]}`}
              style={{ height: `${moodBarHeight(mood)}px` }}
            />
          ))}
        </div>
        <div className={styles.axis}>
          <span>{moodAxis[0]}</span>
          <span>{moodAxis[1]}</span>
        </div>
      </section>

      <section className={styles.panel}>
        <h4 className={styles.peopleTitle}>Named Most Often</h4>
        <div className={styles.people}>
          {topPeople.map((person) => (
            <div key={person.name} className={styles.personRow}>
              <div className={styles.personName}>{person.name}</div>
              <div className={styles.personTrack}>
                <div
                  className={styles.personFill}
                  style={{ width: `${personShare(person.count, topPeople)}%` }}
                />
              </div>
              <div className={styles.personCount}>{person.count}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.gratitude}>
        <div className={styles.gratitudeEyebrow}>Gratitude, in your words</div>
        <div className={styles.quotes}>
          {gratitudeQuotes.map((quote) => (
            <div key={quote.text} className={styles.quote}>
              &ldquo;{quote.text}&rdquo;
              <span className={styles.quoteDate}> &mdash; {quote.date}</span>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.account}>
        <span className={styles.accountEmail}>{user?.email}</span>
        <form action="/auth/signout" method="post">
          <button type="submit" className={styles.signOut}>
            Sign out
          </button>
        </form>
      </div>
    </Screen>
  );
}
