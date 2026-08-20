#!/usr/bin/env node
/**
 * PreToolUse guard for Bash commands.
 *
 * Blocks the git operations that CLAUDE.md rule 6 forbids, mechanically, so that a
 * mistake costs an error message instead of a rewritten history or a broken `main`.
 *
 * This is a backstop for accidents. It is not the reason the rules exist, and it is
 * not a security boundary — anything running on this machine could bypass it. Its
 * job is to make the wrong command loud rather than silent.
 *
 * Contract: reads the hook payload as JSON on stdin. Exit 0 allows the command;
 * exit 2 blocks it and shows stderr to the agent.
 *
 * Written in Node rather than shell so it behaves the same on Windows and Linux
 * and needs no dependency beyond the one this project already requires.
 */

const { execSync } = require("node:child_process");

const PROTECTED_BRANCH = "main";

/** Commands that are never acceptable, whatever the branch. */
const ALWAYS_FORBIDDEN = [
  {
    test: (c) => /\bgit\s+push\b/.test(c) && /(--force(?!-with-lease)|--force-with-lease|\s-f\b)/.test(c),
    why: "force-push rewrites history other clones already have",
  },
  {
    test: (c) => /\bgit\s+reset\b/.test(c) && /--hard\b/.test(c),
    why: "`git reset --hard` destroys uncommitted work with no way back",
  },
  {
    test: (c) => /\bgit\s+commit\b/.test(c) && /--amend\b/.test(c),
    why: "amending rewrites a commit that may already be pushed",
  },
  {
    test: (c) => /\bgit\s+rebase\b/.test(c),
    why: "rebase rewrites history; push a new commit instead",
  },
  {
    test: (c) => /\bgit\s+(filter-branch|filter-repo)\b/.test(c),
    why: "history rewriting is a maintainer decision, never an automated one",
  },
  {
    test: (c) => /\bgit\s+clean\b/.test(c) && /-[a-z]*[fd]/.test(c),
    why: "`git clean -fd` deletes untracked files, including gitignored local ones like the brief and the seed",
  },
  {
    test: (c) => /\bgit\s+checkout\b/.test(c) && /(^|\s)(\.|--\s+\.)(\s|$)/.test(c),
    why: "`git checkout .` discards every uncommitted change in the tree",
  },
  {
    test: (c) => /\bgh\s+pr\s+merge\b/.test(c),
    why: "merging a pull request is the maintainer's decision (CONTRIBUTING.md §4)",
  },
  {
    test: (c) => /\bgit\s+push\b/.test(c) && /--delete\b/.test(c) && new RegExp(`\\b${PROTECTED_BRANCH}\\b`).test(c),
    why: `deleting \`${PROTECTED_BRANCH}\` on the remote`,
  },
  {
    test: (c) => /\bsupabase\b/.test(c) && /\bdb\s+push\b/.test(c),
    why: "migrations are applied to production by a human, with a backup (docs/adr/0003)",
  },
  {
    test: (c) => /\bsupabase\b/.test(c) && /\bmigration\s+up\b/.test(c) && /--linked|--db-url/.test(c),
    why: "migrations are applied to production by a human, with a backup (docs/adr/0003)",
  },
];

function currentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Splits a shell line into the separate commands it will actually run, so that
 * `cd foo && git push --force` is inspected as two commands and not missed.
 */
function segments(command) {
  return command
    .split(/&&|\|\||;|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function violation(segment) {
  for (const rule of ALWAYS_FORBIDDEN) {
    if (rule.test(segment)) return rule.why;
  }

  const isCommit = /\bgit\s+commit\b/.test(segment);
  const isPush = /\bgit\s+push\b/.test(segment);
  if (!isCommit && !isPush) return null;

  // An explicit push to the protected branch, regardless of where HEAD is.
  if (isPush && new RegExp(`\\s(${PROTECTED_BRANCH}|HEAD:${PROTECTED_BRANCH})(\\s|$)`).test(segment)) {
    return `pushing directly to \`${PROTECTED_BRANCH}\``;
  }

  // A commit or bare push while HEAD is on the protected branch.
  if (currentBranch() === PROTECTED_BRANCH) {
    return `committing or pushing while on \`${PROTECTED_BRANCH}\``;
  }

  return null;
}

function main() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      process.exit(0); // Cannot parse the payload: do not block on a guard bug.
    }

    if (payload.tool_name !== "Bash") process.exit(0);

    const command = payload?.tool_input?.command;
    if (typeof command !== "string") process.exit(0);

    for (const segment of segments(command)) {
      const why = violation(segment);
      if (why) {
        process.stderr.write(
          [
            `Blocked by .claude/hooks/git-guard.js: ${why}.`,
            "",
            `Command: ${segment}`,
            "",
            "This is forbidden by CLAUDE.md rule 6. Do not work around it.",
            "Create a branch, commit there, push the branch and open a pull request;",
            "or stop and tell the maintainer what you were trying to do and why.",
          ].join("\n"),
        );
        process.exit(2);
      }
    }

    process.exit(0);
  });
}

main();
