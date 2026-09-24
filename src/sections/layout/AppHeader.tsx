import Link from "next/link";
import { signOut } from "@/app/(app)/actions";
import { appCopy } from "@/copy/app";
import { authCopy } from "@/copy/auth";
import { SyncStatus } from "./SyncStatus";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <span className={styles.title}>{appCopy.title}</span>
        <Link href="/">{appCopy.navDay}</Link>
        <Link href="/cierres">{appCopy.navPeriods}</Link>
        <Link href="/reporte">{appCopy.navReport}</Link>
        <Link href="/revision">{appCopy.navReview}</Link>
      </nav>
      <div className={styles.actions}>
        <SyncStatus />
        <form action={signOut}>
        <button type="submit" className={styles.signOut}>
          {authCopy.signOut}
        </button>
        </form>
      </div>
    </header>
  );
}
