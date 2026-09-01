import Link from "next/link";
import { Screen } from "@/app/components/AppShell";

/**
 * Placeholder. The check-in state machine is step 3; this exists now so Home's
 * Start button goes somewhere during review.
 */
export default function CheckinPage() {
  return (
    <Screen>
      <Link
        href="/"
        style={{
          display: "inline-block",
          fontSize: 15,
          color: "var(--fg-3)",
          textDecoration: "none",
          marginBottom: 18,
        }}
      >
        &larr; Close
      </Link>
      <h3 style={{ fontSize: 26, margin: "0 0 6px" }}>Check-in</h3>
      <p style={{ fontSize: 15, color: "var(--fg-3)" }}>
        The six-step check-in lands in step 3.
      </p>
    </Screen>
  );
}
