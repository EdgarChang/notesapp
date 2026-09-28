"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/app/lib/supabase/client";
import styles from "./signin.module.css";

type Mode = "signin" | "signup" | "reset";

const LEDE: Record<Mode, string> = {
  signin: "Sign in to pick up where you left off.",
  signup: "A minute a night. We ask, you answer, and the year stops being a blur.",
  reset: "Tell us your email and we'll send a link to set a new password.",
};

const CTA: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create account",
  reset: "Send the link",
};

export function SignIn({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      // Anything other than a transport or rate-limit failure is reported the
      // same way below, so the screen never reveals whether an address has an
      // account behind it.
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }

      setNotice(
        "If that address has an account, a link is on its way. It expires in an hour.",
      );
      setBusy(false);
      return;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }

      // With email confirmation on, signUp returns a user but no session.
      if (!data.session) {
        setNotice("Check your email for a confirmation link, then sign in.");
        setBusy(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
    }

    // refresh() so the server re-renders with the new session cookie before we
    // navigate; pushing first would render the destination as signed out.
    router.refresh();
    router.push(next);
  };

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>
          Keepsake
        </div>
        <h2 className={styles.display}>
          Days Go Fast.
          <br />
          Keep A Few.
        </h2>
        <p className={styles.lede}>{LEDE[mode]}</p>

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              disabled={busy}
            />
          </div>

          {mode === "reset" ? null : (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 6 characters" : ""}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              disabled={busy}
            />
          </div>
          )}

          {mode === "signin" ? (
            <button
              type="button"
              className={styles.quietLink}
              onClick={() => {
                setMode("reset");
                setError(null);
                setNotice(null);
              }}
            >
              Forgot your password?
            </button>
          ) : null}

          {error ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className={styles.notice} role="status">
              {notice}
            </div>
          ) : null}

          <button type="submit" className={styles.cta} disabled={busy}>
            {busy ? "One moment…" : CTA[mode]}
          </button>
        </form>
      </div>

      <div className={styles.toggleRow}>
        {mode === "signin" ? "New here?" : "Already have an account?"}
        <button
          type="button"
          className={styles.toggle}
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </div>
    </div>
  );
}
