import type { ReactNode } from "react";
import styles from "./AppShell.module.css";

/**
 * The 452px column, centred on --page. Children are laid out in a flex column:
 * a Screen for the scrollable body, then any pinned chrome such as the tab bar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.column}>{children}</div>
    </div>
  );
}

/**
 * A screen body. `padded` applies the 28/24/24 inset most screens use; the
 * check-in screen opts out because it manages its own header and input dock.
 */
export function Screen({
  children,
  padded = true,
}: {
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className={padded ? `${styles.screen} ${styles.screenPadded}` : styles.screen}>
      {children}
    </div>
  );
}
