# 0005 — Claude Code has full repository access

Date: 2026-08-20
Status: Accepted

Supersedes the agent-restriction part of [0002](0002-trunk-based-with-mandatory-pr.md).

## Context

ADR 0002 set trunk-based development with mandatory pull requests and, inside that, a list of
git operations Claude Code could never perform: commit or push to `main`, force-push, rebase,
amend, merge a pull request. A `PreToolUse` hook in `.claude/hooks/git-guard.js` enforced them
mechanically.

Bootstrapping the repository exposed the first problem. The remote was empty — no `main`
existed anywhere — so the "branch, push, open a PR" loop had no base to open a PR against, and
the one operation that could create that base was the one operation the rules forbade. The
process could not produce its own starting conditions.

The second problem is that the prohibition never bought what it appeared to buy. It is not an
access control: everything Claude Code runs, it runs on the maintainer's machine with the
maintainer's credentials. The hook itself says so in its header comment. A rule that reads like
a boundary but is really a convention is worse than no rule, because it invites trusting it.

The real boundary turned out to be somewhere else entirely. During bootstrap, the GitHub account
authenticated in `gh` had `push: false` and `admin: false` on the repository. No edit to any
file in this repo could have changed that, and no edit to any file in this repo could have
bypassed it. Server-side permissions are the access control model. The rules in `CLAUDE.md` are
a working agreement between the maintainer and an agent, which is a different kind of thing.

## Decision

Claude Code has complete git access in this repository: branch, commit, push, commit to and push
`main`, merge pull requests, rebase, amend, force-push.

Two prohibitions survive, because neither is about git:

- **The "never commit" list in `CONTRIBUTING.md` §7.** The repository is public. A pushed
  `service_role` key is scraped within minutes and stays burned after the commit is deleted.
- **Applying migrations to Supabase (`docs/adr/0003`).** One project, and it is production, with
  real payroll data and no test environment to be wrong in.

The `PreToolUse` hook and `.claude/hooks/git-guard.js` are removed rather than left in place
enforcing a shorter list. A guard that blocks nothing still reads like a safety net.

The pull request workflow from 0002 stays as the documented default for changes that touch
behaviour. It is now a working agreement rather than a mechanical prohibition, and it is stated
that way in `CONTRIBUTING.md` §1.

## Consequences

**Makes easy:** the agent can bootstrap the repository, fix `main` when it breaks, and merge its
own work without the maintainer becoming a manual relay for operations they would have approved
anyway. The rules now describe what actually constrains the system instead of what was hoped to.

**Makes hard:** review is no longer structural. Under 0002, code reached `main` only through a
diff someone had the chance to read; the agent can now put a commit on `main` that nobody read.
On a repository that computes wages, that is a real cost and it is accepted knowingly.

**The weak point:** this decision moves safety from a mechanism to a habit, and habits decay
under time pressure. The mitigation is that the two surviving prohibitions are the two whose
failure modes are irreversible — a leaked key and a bad production migration — and both stay
absolute.

**Would make us revisit:** a second developer or a non-maintainer contributor, real payroll data
in production, or a single incident traceable to an unreviewed commit on `main`. Any of those
should restore the ruleset — enforced server-side by GitHub, where enforcement actually lives,
rather than by a hook in the repository it is meant to protect.
