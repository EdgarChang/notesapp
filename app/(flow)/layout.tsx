import { AppShell } from "@/app/components/AppShell";

/**
 * Full-bleed flows that hide the tab bar: onboarding and the nightly check-in.
 * Same 452px shell, no bottom chrome.
 */
export default function FlowLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
