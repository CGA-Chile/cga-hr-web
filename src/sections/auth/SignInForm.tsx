"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/ingresar/actions";
import { authCopy } from "@/copy/auth";
import styles from "./SignInForm.module.css";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, null);

  return (
    <form action={action} className={styles.form}>
      <h1 className={styles.title}>{authCopy.signInTitle}</h1>

      <label className={styles.field}>
        <span className={styles.label}>{authCopy.usernameLabel}</span>
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className={styles.input}
        />
        <span className={styles.hint}>{authCopy.usernameHint}</span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{authCopy.pinLabel}</span>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          pattern="\d{6}"
          maxLength={6}
          required
          className={styles.input}
        />
        <span className={styles.hint}>{authCopy.pinHint}</span>
      </label>

      {state && (
        <p role="alert" className={styles.message}>
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className={styles.submit}>
        {pending ? authCopy.submitting : authCopy.submit}
      </button>
    </form>
  );
}
