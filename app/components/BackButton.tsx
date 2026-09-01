"use client";

import { useRouter } from "next/navigation";

/**
 * Returns to wherever the entry was opened from, per the handoff's navigation
 * note. Falls back to Home when there is no history to go back to, which is the
 * case for a deep link.
 */
export function BackButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
    >
      &larr; Back
    </button>
  );
}
