import Link from "next/link";
import { signOut } from "@/app/(app)/actions";
import { appCopy } from "@/copy/app";
import { authCopy } from "@/copy/auth";
import { roleSeesAmounts, type AppRole } from "@/utils/supabase/currentProfile";
import { SyncStatus } from "./SyncStatus";
import styles from "./AppHeader.module.css";

/**
 * The sheet and the day for every role; closes, reports and review for the roles that see
 * amounts; administration for the admin. Hiding a link is courtesy; RLS decides.
 */
export function AppHeader({ role }: { role: AppRole | null }) {
  const seesAmounts = roleSeesAmounts(role);
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <span className={styles.title}>{appCopy.title}</span>
        <Link href="/planilla">{appCopy.navSheet}</Link>
        <Link href="/dia">{appCopy.navDay}</Link>
        {seesAmounts && (
          <>
            <Link href="/cierres">{appCopy.navPeriods}</Link>
            <Link href="/reporte">{appCopy.navReport}</Link>
            <Link href="/revision">{appCopy.navReview}</Link>
          </>
        )}
        {role === "admin" && <Link href="/administracion">{appCopy.navAdmin}</Link>}
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
