# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the
codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the glossary for the terms that carry the rules.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.
- **`docs/DOMAIN.md`** — specific to this repo, and the reason the two above are not enough on
  their own. It is the versioned source of truth for the domain rules, in Spanish, and it holds
  the fourteen mandatory calculation cases. `CONTEXT.md` names the concepts; `DOMAIN.md` states
  what they do.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest
creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and
`/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This is a single-context repo:

```
/
├── CONTEXT.md
├── docs/
│   ├── DOMAIN.md
│   └── adr/
│       ├── 0001-public-repository.md
│       └── …
└── src/
```

There is no `CONTEXT-MAP.md` and no per-context `docs/adr/`. If this ever becomes a multi-package
repo, that is the moment to revisit the layout — not before.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a
test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary
explicitly avoids.

Two pairs are worth naming because they look alike and are not: an **anomaly** is derived state
that clears itself when the data is corrected, while a **review item** is a recorded event that is
acknowledged rather than corrected. A **scheme trigger** is a property of a position, never a
position code the calculation recognises.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing
language the project doesn't use (reconsider) or there's a real gap (note it for
`/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0004 (daily cap applies only to EQUAL_SHARE) — but worth reopening because…_

ADRs here are append-only. A decision that genuinely changes gets a new ADR that supersedes the
old one, and a decision that grows gets one that extends it; the old file stays either way. ADR
0006 extending 0004 is the worked example.
