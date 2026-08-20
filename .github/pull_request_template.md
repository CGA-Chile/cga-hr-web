## What changes

<!-- One or two sentences. What is different after this merges. -->

## Why

<!-- The reason this exists. Link the issue if there is one: Closes #NN
     The diff already says what changed; this section is the part that
     is impossible to reconstruct in six months. -->

## How to verify

<!-- Concrete steps a person can follow. "Open the preview, go to the day view,
     assign two people to Rieter, check the summary marks the total."
     Not "tested locally". -->

## Checklist

- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run build` pass locally
- [ ] I read my own diff in the Files Changed tab, top to bottom
- [ ] No `any`, no `console.log`, no commented-out code, no TODO without an issue
- [ ] Comments and names in English; user-facing strings in Spanish, in `src/copy/`

### If this touches the bonus calculation

- [ ] There is a test that **fails without this change**
- [ ] No amount is hardcoded — rates come from `bonus_settings` / `bonus_position_rates`
- [ ] The relevant mandatory case in `docs/DOMAIN.md` §5 still passes

### If this touches the database

- [ ] Migration committed in `supabase/migrations/`
- [ ] Types regenerated from a reset local database, in this same PR
- [ ] RLS policy written for any new table
- [ ] Unique indexes are partial: `WHERE deleted_at IS NULL`
- [ ] Change is additive — no `DROP` riding along with other work
- [ ] I will apply this to production by hand after merge, with a backup taken first

### If this touches a screen

- [ ] I opened the Vercel preview and clicked through it
- [ ] Nothing blocks the user; anomalies are shown, not prevented
- [ ] Screen opens in read mode

## Decisions worth recording

<!-- Did you decide something non-obvious or hard to reverse?
     If yes, add an ADR in docs/adr/ and link it here. If no, write "none". -->
