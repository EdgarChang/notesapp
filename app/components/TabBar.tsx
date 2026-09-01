"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TabBar.module.css";

type Tab = {
  label: string;
  href: string;
  /** Extra path prefixes that should also light this tab up. */
  alsoMatches?: string[];
};

const TABS: Tab[] = [
  // Entry detail is reached from Today, so it keeps Today lit.
  { label: "Today", href: "/", alsoMatches: ["/entry"] },
  { label: "Timeline", href: "/timeline" },
  { label: "Insights", href: "/insights" },
];

function isActive(tab: Tab, pathname: string): boolean {
  if (tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href)) {
    return true;
  }
  return tab.alsoMatches?.some((prefix) => pathname.startsWith(prefix)) ?? false;
}

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className={styles.bar} aria-label="Main">
      {TABS.map((tab) => {
        const active = isActive(tab, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            aria-current={active ? "page" : undefined}
          >
            <span className={styles.dot} aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
