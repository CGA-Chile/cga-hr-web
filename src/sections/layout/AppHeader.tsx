import { signOut } from "@/app/(app)/actions";
import { appCopy } from "@/copy/app";
import { authCopy } from "@/copy/auth";
import { SyncStatus } from "./SyncStatus";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  return (
    <header className={styles.header}>
      <span className={styles.title}>{appCopy.title}</span>
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
