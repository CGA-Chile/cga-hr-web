"use client";

import { useState, useTransition } from "react";
import { confirmEmployeeRut } from "@/app/(app)/administracion/attendanceActions";
import { adminCopy } from "@/copy/admin";
import type { EmployeeMatching, MatchProposal } from "@/domain/attendance/employeeMatch";
import styles from "./Admin.module.css";

const copy = adminCopy.sync.mapping;

/** What the app and Workera share, what is only proposed, and what fits nobody. */
export function EmployeeMapping({ matching }: { matching: EmployeeMatching }) {
  return (
    <div className={styles.form}>
      <p className={styles.muted}>{copy.matched(matching.matchedCount)}</p>

      <h2 className={styles.subtitle}>{copy.proposalsTitle}</h2>
      {matching.proposals.length === 0 ? (
        <p className={styles.muted}>{copy.noProposals}</p>
      ) : (
        <>
          <p className={styles.muted}>{copy.proposalsHint}</p>
          <ul className={styles.list}>
            {matching.proposals.map((proposal) => (
              <ProposalRow key={proposal.employee.id} proposal={proposal} />
            ))}
          </ul>
        </>
      )}

      {matching.unmatched.length > 0 && (
        <>
          <h2 className={styles.subtitle}>{copy.unmatchedTitle}</h2>
          <p className={styles.muted}>{copy.unmatchedHint}</p>
          <ul className={styles.list}>
            {matching.unmatched.map((employee) => (
              <li key={employee.id}>
                {`${employee.firstName} ${employee.lastName}`}
                {employee.nationalId && ` · ${employee.nationalId}`}
              </li>
            ))}
          </ul>
        </>
      )}

      {matching.onlyInWorkera.length > 0 && (
        <>
          <h2 className={styles.subtitle}>{copy.onlyInWorkeraTitle}</h2>
          <p className={styles.muted}>{copy.onlyInWorkeraHint}</p>
          <ul className={styles.list}>
            {matching.onlyInWorkera.map((person) => (
              <li key={person.nationalId}>{`${person.fullName} · ${person.nationalId}`}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ProposalRow({ proposal }: { proposal: MatchProposal }) {
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<string | null>(null);
  const { employee, person } = proposal;

  return (
    <li>
      <span>{copy.proposal(`${employee.firstName} ${employee.lastName}`, person.fullName, person.nationalId)}</span>{" "}
      <button
        type="button"
        className={styles.button}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setRefusal((await confirmEmployeeRut(employee.id, person.nationalId))?.message ?? null);
          })
        }
      >
        {pending ? adminCopy.saving : copy.confirm}
      </button>
      {refusal && (
        <p role="alert" className={styles.alert}>
          {refusal}
        </p>
      )}
    </li>
  );
}
