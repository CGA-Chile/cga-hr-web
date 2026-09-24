import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Drawer.module.css";

type DrawerProps = {
  title: string;
  /** Where closing goes: the same page without the parameter that opened the drawer. */
  closeHref: string;
  closeLabel: string;
  children: ReactNode;
};

/** A side panel for entity detail or editing. Its open state lives in the URL. */
export function Drawer({ title, closeHref, closeLabel, children }: DrawerProps) {
  return (
    <div className={styles.layer}>
      <Link href={closeHref} scroll={false} className={styles.backdrop} aria-label={closeLabel} />
      <aside role="dialog" aria-modal="true" aria-labelledby="drawer-title" className={styles.panel}>
        <header className={styles.header}>
          <h2 id="drawer-title" className={styles.title}>
            {title}
          </h2>
          <Link href={closeHref} scroll={false} className={styles.close}>
            {closeLabel}
          </Link>
        </header>
        <div className={styles.body}>{children}</div>
      </aside>
    </div>
  );
}
