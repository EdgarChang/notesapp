import { notFound } from "next/navigation";
import { Screen } from "@/app/components/AppShell";
import { BackButton } from "@/app/components/BackButton";
import { STATIC_BARS } from "@/app/lib/checkin";
import {
  formatDuration,
  getEntry,
  longDate,
  MOOD_LABELS,
  weekdayName,
} from "@/app/lib/entries";
import styles from "../entry.module.css";

export default async function EntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = getEntry(id);
  if (!entry) notFound();

  return (
    <Screen padded={false}>
      <div className={styles.backRow}>
        <BackButton className={styles.back} />
      </div>

      <div className={styles.body}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          {weekdayName(entry.entryDate)}
        </div>
        <h3 className={styles.date}>{longDate(entry.entryDate)}</h3>

        <div className={styles.pills}>
          <span className={styles.moodPill}>{MOOD_LABELS[entry.mood]}</span>
          {entry.tags.map((tag) => (
            <span key={tag} className={styles.tagPill}>
              {tag}
            </span>
          ))}
        </div>

        {entry.hasPhoto ? (
          <div className={styles.photo}>
            <div className={styles.photoArea}>
              <span className={styles.photoTag}>photo placeholder</span>
            </div>
          </div>
        ) : null}

        <p className={styles.summary}>{entry.summary}</p>

        {entry.voiceDurationSeconds !== null ? (
          <div className={styles.voice}>
            <div className={styles.voiceHead}>
              <div className={styles.play} aria-hidden="true">
                &#9654;
              </div>
              <div className={styles.waveform} aria-hidden="true">
                {STATIC_BARS.map((height, i) => (
                  <div
                    key={i}
                    className={styles.bar}
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
              <div className={styles.voiceDuration}>
                {formatDuration(entry.voiceDurationSeconds)}
              </div>
            </div>
            <div className={styles.gratitude}>Grateful for: {entry.gratitude}</div>
          </div>
        ) : null}

        {entry.lastYear ? (
          <div className={styles.lastYear}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              One year ago
            </div>
            <div className={styles.lastYearBody}>{entry.lastYear}</div>
          </div>
        ) : null}
      </div>
    </Screen>
  );
}
