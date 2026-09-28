"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/app/lib/supabase/client";
// Same treatment as the sign-in screen, so it shares that stylesheet rather
// than keeping a second copy of it in step with the first.
import styles from "../signin/signin.module.css";

/** Matches the minimum the sign-up field already enforces. */
const MIN_LENGTH = 6;

export function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    if (password !== confirm) {
      setError("Those two don't match.");
      return;
    }

    setBusy(true);
    setError(null);

    // The recovery link already exchanged its code for a session, so this runs
    // as the signed-in user.
    const { error } = await createClient().auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    router.refresh();
    router.push("/");
  };

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>
          Keepsake
        </div>
        <h2 className={styles.display}>Set A New Password.</h2>
        <p className={styles.lede}>
          Pick something you&rsquo;ll remember. You&rsquo;ll stay signed in on
          this device.
        </p>

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              New password
            </label>
            <input
              id="password"
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`At least ${MIN_LENGTH} characters`}
              autoComplete="new-password"
              required
              minLength={MIN_LENGTH}
              disabled={busy}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirm">
              Again
            </label>
            <input
              id="confirm"
              className={styles.input}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={MIN_LENGTH}
              disabled={busy}
            />
          </div>

          {error ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : null}

          <button type="submit" className={styles.cta} disabled={busy}>
            {busy ? "One moment…" : "Save it"}
          </button>
        </form>
      </div>
    </div>
  );
}
