# 0001 — Public repository, with sensitive material kept out

Date: 2026-08-14
Status: Accepted

## Context

This is an internal tool for a real company, built by a single maintainer who also wants it to
serve as a portfolio piece. Those two goals pull in opposite directions: a portfolio repository
has to be readable by strangers, and an internal payroll tool contains information the company
has no interest in publishing — bonus amounts, employee names, national ID numbers, and the
precise logic by which people get paid.

GitHub's branch protection rulesets are free on public repositories and require a paid plan on
private ones. Since a single-maintainer project depends on mechanical enforcement rather than a
second pair of eyes, that is a material advantage for the public option.

## Decision

The repository is **public**. Sensitive material is excluded from version control rather than
hidden by repository visibility:

- `BRIEF-app-bonos-carda.md`, the internal product document with real amounts and real names,
  is gitignored and lives only on the maintainer's machine and in the team's document store.
- `docs/DOMAIN.md` is the versioned, public counterpart. It carries every rule, every data
  model and every test case, with **example amounts** that preserve the structure of each rule
  but not the real figures.
- Seed files with employee names, RUT and production rates match `seed/*.local.*` and are
  gitignored. A fictional example seed is versioned so anyone can run the project.
- No `.env`, ever. Only `.env.example` with empty values.

The real amounts never belonged in source anyway — they live in `bonus_settings` and
`bonus_position_rates`, versioned by effective date, because rates change and closed periods
must not be recalculated. Public visibility adds a second reason for a rule that already
existed for a first.

## Consequences

**Makes easy:** free branch protection rulesets and unlimited Actions minutes; free secret
scanning with push protection; a repository that can be shown to anyone without redaction.

**Makes hard:** every commit is permanent and irreversible in public. A secret pushed by
accident must be treated as burned and rotated, not merely removed from history. The discipline
in `CONTRIBUTING.md` §7 is not optional under this decision — it is what makes it survivable.

**Also costs:** a fresh clone does not contain the internal brief, so `docs/DOMAIN.md` must stay
genuinely complete rather than becoming a stub that points at a document nobody outside can
read. If those two documents drift, the public one is the one that breaks.

**Would make us revisit:** the client asking that the logic not be public, or the app growing to
handle data beyond bonus assignments — attendance, wages, contracts — where "the sensitive part
is just the numbers" would stop being true.
