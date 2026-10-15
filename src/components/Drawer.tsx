import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Drawer.module.css";

/**
 * How the drawer closes: a link to the same page without the parameter that opened it, or, for a
 * drawer the browser opened on its own, a callback that does the same without a server render.
 */
type DrawerClose = { closeHref: string; onClose?: never } | { onClose: () => void; closeHref?: never };

type DrawerProps = DrawerClose & {
  title: string;
  closeLabel: string;
  children: ReactNode;
};

/** A side panel for entity detail or editing. Its open state lives in the URL. */
export function Drawer({ title, closeHref, onClose, closeLabel, children }: DrawerProps) {
  return (
    <div className={styles.layer}>
      {closeHref ? (
        <Link href={closeHref} scroll={false} className={styles.backdrop} aria-label={closeLabel} />
      ) : (
        <button type="button" onClick={onClose} className={styles.backdrop} aria-label={closeLabel} />
      )}
      <aside role="dialog" aria-modal="true" aria-labelledby="drawer-title" className={styles.panel}>
        <header className={styles.header}>
          <h2 id="drawer-title" className={styles.title}>
            {title}
          </h2>
          {closeHref ? (
            <Link href={closeHref} scroll={false} className={styles.close}>
              {closeLabel}
            </Link>
          ) : (
            <button type="button" onClick={onClose} className={styles.close}>
              {closeLabel}
            </button>
          )}
        </header>
        <div className={styles.body}>{children}</div>
      </aside>
    </div>
  );
}
