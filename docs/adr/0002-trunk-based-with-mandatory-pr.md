# 0002 — Trunk-based development with mandatory pull requests

Date: 2026-08-14
Status: Superseded by 0005

## Context

One human maintainer and one AI contributor (Claude Code). The obvious argument against process
is that a solo developer reviewing their own pull requests is theatre — there is no second
person, so what is the review for?

That argument is wrong here for three specific reasons:

1. **The AI writes a large share of the code.** A pull request is the mechanism by which the
   maintainer reads what an agent produced before it reaches production. Without it, generated
   code goes straight to `main` and gets reviewed by nobody.
2. **This app computes wages.** A bug pays someone the wrong amount, and the person who notices
   is a plant worker looking at a payslip, weeks later.
3. **The maintainer wants to learn the practice.** A workflow only becomes habit if it is used
   when it is not strictly necessary. Adopting it later, on a repository with history and
   deployed users, is much more expensive.

Git-flow was considered and rejected: a `develop` branch, release branches and back-merges
solve a coordination problem that does not exist with one maintainer and continuous deployment
to Vercel.

## Decision

Trunk-based development.

- `main` is the only long-lived branch. It is always deployable and always deployed.
- All work happens on short-lived branches (one to two days) and reaches `main` through a pull
  request. No direct commits, no exceptions.
- Merges are **squash merges**, one commit per PR.
- CI (lint, typecheck, test, build) must pass before merge.
- A GitHub ruleset on `main` enforces: pull request required, status checks required,
  force-push blocked, deletion blocked.
- **Zero approvals required.** GitHub does not allow approving one's own pull request; requiring
  one approval would deadlock a single-maintainer repository.

Claude Code operates inside this workflow: it may branch, commit, push and open PRs, and may not
touch `main`, merge, or rewrite history. A `PreToolUse` hook enforces the prohibitions
mechanically.

## Consequences

**Makes easy:** every change on `main` has a description explaining why it exists. Every change
has a Vercel preview URL that non-technical users can open and check before it is real.
`git bisect` works, because `main` is a clean sequence of squashed, working commits.

**Makes hard:** shipping a one-line fix takes a branch, a push, a PR and a CI run instead of
thirty seconds. This is the cost of the decision and it is accepted deliberately. The temptation
to bypass it will be strongest exactly when bypassing it is most dangerous — during an incident.

**The weak point:** requiring zero approvals means nothing stops the maintainer from merging a
pull request without reading it. No configuration can fix that; the ruleset guarantees the pull
request exists, not that anyone looked at it. The review is a discipline, and it is the part of
this decision that actually produces the value.

**Would make us revisit:** a second developer joining, at which point required approvals goes to
one and `CODEOWNERS` becomes meaningful rather than documentary.
