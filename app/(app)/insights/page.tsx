import { Screen } from "@/app/components/AppShell";
import { todayIso } from "@/app/lib/entries";
import { moodBarHeight, moodTone } from "@/app/lib/insights";
import {
  getGratitudeQuotes,
  getMoodSeries,
  getRetrospect,
  getUser,
  getWeeklyNote,
} from "@/app/lib/queries";
import { resolveRange } from "@/app/lib/retrospect";
import { Retrospect } from "../Retrospect";
import styles from "../insights.module.css";

export const dynamic = "force-dynamic";

const TONE_CLASS = {
  high: styles.moodHigh,
  mid: styles.moodMid,
  low: styles.moodLow,
} as const;

export default async function InsightsPage() {
  const today = todayIso();
  const thisWeek = resolveRange("week", today);
  const [user, weekly, mood, quotes, storedRetrospect] = await Promise.all([
    getUser(),
    getWeeklyNote(),
    getMoodSeries(14, today),
    getGratitudeQuotes(3),
    // Only loaded, never generated on render: writing one is slow and costs a
    // call, so it happens when asked for.
    getRetrospect(thisWeek.start, thisWeek.end),
  ]);

  // The weekly note comes from a scheduled job that does not exist yet, so the
  // chart, people and quotes are composed from entries in the meantime.
  const series: (typeof mood.series)[number][] = weekly?.moodSeries.length
    ? weekly.moodSeries
    : mood.series;
  const axis = weekly?.moodSeries.length ? weekly.moodAxis : mood.axis;
  const gratitudeQuotes = weekly?.gratitudeQuotes.length
    ? weekly.gratitudeQuotes
    : quotes;

  const hasMood = series.some((m) => m !== null);
  const hasAnything = weekly !== null || hasMood || gratitudeQuotes.length > 0;

  return (
    <Screen>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        {weekly?.weekLabel ?? "This week"}
      </div>
      <h3 className={styles.heading}>
        What We&rsquo;re Learning
        <br />
        About You
      </h3>

      {!hasAnything ? (
        <p style={{ fontSize: 15, color: "var(--fg-3)", marginBottom: 28 }}>
          Nothing to show yet. Keep a few days and patterns start turning up here.
        </p>
      ) : null}

      {weekly?.note ? (
        <section className={styles.statement}>
          <p className={styles.statementNote}>{weekly.note}</p>
          {weekly.whatChanged ? (
            <div className={styles.statementChange}>{weekly.whatChanged}</div>
          ) : null}
        </section>
      ) : null}

      {hasMood ? (
        <section className={styles.panel}>
          <h4 className={styles.panelTitle}>Mood, Last 14 Days</h4>
          <div className={styles.chart}>
            {series.map((m, i) =>
              m === null ? (
                // A day with no entry keeps its slot so the chart's shape holds.
                <div key={i} className={styles.moodGap} aria-hidden="true" />
              ) : (
                <div
                  key={i}
                  className={`${styles.moodBar} ${TONE_CLASS[moodTone(m)]}`}
                  style={{ height: `${moodBarHeight(m)}px` }}
                />
              ),
            )}
          </div>
          <div className={styles.axis}>
            <span>{axis[0]}</span>
            <span>{axis[1]}</span>
          </div>
        </section>
      ) : null}

      <Retrospect today={today} initial={storedRetrospect} />

      {gratitudeQuotes.length > 0 ? (
        <section className={styles.gratitude}>
          <div className={styles.gratitudeEyebrow}>Gratitude, in your words</div>
          <div className={styles.quotes}>
            {gratitudeQuotes.map((quote) => (
              <div key={`${quote.date}-${quote.text}`} className={styles.quote}>
                &ldquo;{quote.text}&rdquo;
                <span className={styles.quoteDate}> &mdash; {quote.date}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
