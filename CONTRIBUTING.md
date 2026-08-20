# Contributing

How work gets from an idea into production in this repository. These rules apply to
**everyone**, human or agent. Claude Code loads this file through `CLAUDE.md`, so there is
one set of rules, not two.

The project computes wages. That single fact drives every rule below: `main` is always
deployable, nothing reaches production without passing CI, and no change to the bonus
calculation merges without a test that covers it.

---

## 1. The loop

```
1. Create a branch off up-to-date main
2. Commit small, self-contained changes
3. Push the branch and open a PR
4. CI runs; Vercel builds a preview
5. Read your own diff. Fix what you find.
6. Squash merge. Branch is deleted automatically.
```

Nobody commits to `main`. Not for a typo, not for a one-line fix, not "just this once".
The branch protection ruleset enforces it, but the rule exists whether or not a machine is
checking.

## 2. Branches

Off `main`, always. Short-lived — if a branch is alive more than about two days, the work
was too big and should have been split.

```
<type>/<short-kebab-description>
```

| Prefix | For |
|---|---|
| `feat/` | New user-visible capability |
| `fix/` | A bug |
| `refactor/` | Behaviour unchanged, structure improved |
| `chore/` | Tooling, config, dependencies, CI |
| `docs/` | Documentation only |
| `test/` | Tests only |

Examples: `feat/daily-view-grid`, `fix/partial-unique-index-on-assignments`,
`chore/github-actions-ci`.

Never rebase, force-push or amend a branch that has an open PR someone is reading. Push a
new commit instead.

## 3. Commits

[Conventional Commits](https://www.conventionalcommits.org/). English, imperative mood,
lowercase after the colon, no trailing period.

```
<type>(<scope>): <subject>

<body — why, not what. The diff already says what.>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `build`, `ci`.
Scope is optional and names the area: `bonus`, `assignments`, `auth`, `db`, `ui`.

```
feat(bonus): derive scheme from inline packing presence
fix(db): make assignments unique index partial on deleted_at
test(bonus): cover the twelve mandatory calculation cases
```

**One logical change per commit.** A commit that adds a feature and reformats forty files
is unreviewable. If you catch yourself writing "and" in a commit subject, it is two commits.

A commit must leave the tree in a working state — it builds, it typechecks, tests pass.
Commits are the unit of `git bisect`; a broken commit in history costs an hour some future
afternoon.

## 4. Pull requests

Every change goes through one. The PR is not bureaucracy — it is the moment where you stop
being the author and start being the reviewer, and it is the only artifact that explains
*why* a change happened once the code is six months old.

**Keep them small.** Under ~400 lines of real change. Beyond that, review quality collapses
and approval becomes a rubber stamp. Split by concern: schema migration in one PR, the UI
that uses it in the next.

Fill in the template. "Updates stuff" is not a description.

**Review your own diff before requesting merge.** Open the Files Changed tab and read it
top to bottom as if someone else wrote it. This catches more than you expect: leftover
`console.log`, a Spanish comment in a `.ts` file, a hardcoded amount, a test that was
skipped and never re-enabled.

**Squash merge only.** One commit per PR on `main`, with the PR number in the subject.
`main` history stays readable; the granular commits stay on the PR for archaeology.

Merge your own PR once CI is green. With a single maintainer, requiring an approval would
deadlock the repo — GitHub does not let you approve your own pull request. The ruleset
therefore requires a PR and passing checks, but zero approvals. That is a deliberate
trade-off, not an oversight; when a second developer joins, raise it to one approval.

## 5. Continuous integration

Every PR runs, and all must pass before merge:

| Check | Command |
|---|---|
| Lint | `npm run lint` |
| Types | `npx tsc --noEmit` |
| Tests | `npm run test` |
| Build | `npm run build` |

If CI is red, the fix is the code, not the check. Never disable a rule or skip a test to go
green — if a rule is genuinely wrong, remove it in its own PR with the reasoning written
down.

Vercel builds a preview deployment for every PR and comments the URL. Use it. For anything
touching a screen, open the preview and click through it before merging; the users of this
app cannot read a diff, and the preview URL is how they can look at something before it is
real.

## 6. Database migrations

**Read this section before touching the schema.** There is one Supabase project and it is
production. A bad migration does not break a test environment — it touches real payroll
data. See `docs/adr/0003-single-supabase-project.md` for why this is the current setup and
what would change it.

Rules, in order of importance:

1. **Migrations are never applied by CI or by an agent.** A human applies them, by hand,
   after the PR is merged, with a backup taken first. CI only checks that the code compiles
   against the committed types.
2. **Additive first.** Add a column, backfill it, ship the code that uses it. Only in a
   later, separate PR remove what it replaced. Never add-and-remove in one step.
3. **`DROP TABLE` and `DROP COLUMN` go in their own PR**, alone, with the reason in the
   description and a note confirming a backup exists. Nothing else rides along.
4. **Never modify the schema from the Supabase dashboard.** If it is not in
   `supabase/migrations/`, it does not exist. A dashboard edit is invisible to the repo and
   will be silently reverted by the next migration that assumes otherwise.
5. **One migration per PR**, named for what it does:
   `npx supabase migration new add_settled_amount_to_assignments`.
6. **Regenerate types in the same PR** as the migration:
   `npx supabase gen types typescript --local > src/types/database.ts`. Types generated
   against a local database that has drifted from production make `tsc` confidently wrong.
   Reset local first: `npx supabase db reset`.

Day-to-day development runs against a local Supabase instance (`npx supabase start`), not
against production.

### The rollback question

Migrations are forward-only. There is no `down` migration. If a migration is wrong, the fix
is a new migration that corrects it — because by the time you notice, production already
has data shaped by the bad one and running its inverse would destroy that data.

This is why rule 2 exists: an additive migration is always safe to leave in place while you
write the correction.

## 7. Secrets, and the fact that this repo is public

This repository is public (see `docs/adr/0001-public-repository.md`). Everything committed
is permanently visible, including anything you commit and then delete — git keeps it.

**Never commit:**

- `.env` / `.env.local` — only `.env.example`, with empty values
- The Supabase `service_role` key, anywhere, ever. It bypasses Row Level Security. In a
  public repo it is scraped within minutes of being pushed.
- Real employee data: names, RUT, the seed file that contains them
- `BRIEF-app-bonos-carda.md` — the internal product document, with real bonus amounts
- `.claude/settings.local.json` — machine-local, and may hold personal configuration

The Supabase `anon` key is designed to be public and ships in the client bundle. It is safe
*only because* Row Level Security is enabled on every table. This is why "RLS on every
table, no exceptions" is a hard rule and not a nice-to-have: in this project it is the
entire access control model.

Turn on GitHub **secret scanning with push protection** in repository settings. It is free
on public repos and it will block a push that contains a recognisable key. Treat it as a
seatbelt, not a strategy.

If a secret is ever pushed: rotate it first, immediately, in Supabase. Then worry about the
history. A key that has touched a public repo is burned even if the commit is gone —
removing it from history does not un-scrape it.

## 8. Definition of Done

A change is done when all of these are true. Not "when it works on my machine".

- [ ] It does what the PR says it does, and nothing else
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run build` all pass locally
- [ ] New or changed behaviour has a test. **Any change to `src/domain/bonus/` has a test
      that fails without the change** — this is not negotiable
- [ ] No `any`. No `console.log`. No commented-out code. No TODO without an issue number
- [ ] Comments, names and log messages in English; user-facing strings in Spanish, in
      `src/copy/`
- [ ] If the schema changed: migration committed, types regenerated, RLS policy written
- [ ] If a screen changed: opened the Vercel preview and clicked through it
- [ ] If a decision was made that a future reader would ask "why?" about: an ADR in
      `docs/adr/`

## 9. Architecture Decision Records

When a decision is non-obvious, hard to reverse, or you had to think about it for more than
a few minutes, record it in `docs/adr/NNNN-short-title.md`:

```markdown
# NNNN — Title

Date: YYYY-MM-DD
Status: Accepted | Superseded by NNNN

## Context
What situation forced a decision. Facts, not opinions.

## Decision
What we are doing.

## Consequences
What this makes easy, what it makes hard, and what would make us revisit it.
```

ADRs are append-only. A decision that changes gets a new ADR that supersedes the old one;
the old file stays, marked `Superseded`. The value is the trail, not the current state.

## 10. Working with Claude Code

Claude Code is a contributor here and follows the same rules. `CLAUDE.md` states what it may
and may not do with git; the short version:

**It may:** create branches, commit, push its own branch, open PRs.

**It may not:** commit to `main`, force-push, `git reset --hard`, rewrite shared history,
merge its own PR, or commit anything from the "never commit" list above.

A `PreToolUse` hook in `.claude/hooks/git-guard.sh` blocks the destructive commands
mechanically. The hook is a backstop for accidents — it is not the reason the rules exist,
and it should never be the only thing standing between a mistake and `main`.

**You still review the PR.** An agent that opens a well-formatted PR with a clean commit
history and a filled-in template is not thereby correct. The review step is the point where
you understand the change; skipping it because the diff looks tidy defeats the entire
process this document describes.
