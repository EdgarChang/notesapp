import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

/**
 * Our own copy for the failures Supabase reports back on the redirect.
 *
 * Deliberately a lookup rather than reflecting `error_description`: that value
 * arrives in the URL and would be rendered on the sign-in screen, which makes
 * it a way to put arbitrary text in front of someone through a crafted link.
 */
const REASONS: Record<string, string> = {
  otp_expired: "That link has expired. Ask for a new one.",
  access_denied: "That link is no longer valid. Ask for a new one.",
};

const GENERIC = "That link did not work. Try signing in again.";

function backToSignIn(origin: string, message: string) {
  return NextResponse.redirect(
    `${origin}/signin?error=${encodeURIComponent(message)}`,
  );
}

/**
 * Where Supabase returns the browser after an email confirmation link, a
 * password recovery link, or an OAuth round trip. Exchanges the one-time code
 * for a session cookie.
 *
 * A recovery link lands here too, with `next=/reset-password`. The exchange is
 * what gives that screen its session, so it has to happen before the redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Only ever redirect within this app. An absolute URL here would make the
  // callback an open redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // Supabase reports a dead or expired link by redirecting here with these,
  // and no code.
  const errorCode = searchParams.get("error_code") ?? searchParams.get("error");
  if (errorCode) {
    return backToSignIn(origin, REASONS[errorCode] ?? GENERIC);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return backToSignIn(origin, GENERIC);
}
