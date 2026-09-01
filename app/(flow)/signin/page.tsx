import { SignIn } from "./SignIn";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  // Only accept in-app destinations, so ?next= cannot bounce someone offsite.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return <SignIn next={safeNext} initialError={error} />;
}
