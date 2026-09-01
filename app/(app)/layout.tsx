import { AppShell } from "@/app/components/AppShell";
import { TabBar } from "@/app/components/TabBar";

/**
 * Screens that carry the bottom tab bar: Today, Timeline, Insights, entry detail.
 * Onboarding and check-in live outside this group because they hide the tabs.
 */
export default function TabLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell>
      {children}
      <TabBar />
    </AppShell>
  );
}
