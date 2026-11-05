# 0020 — A refusal never uses a retryable SQLSTATE

Date: 2026-11-05
Status: Accepted

## Context

`close_period` refused a plan that no longer matched what is owed by raising
`serialization_failure` (40001). The name fit, and the app turned the code into a message asking the
user to review the page and try again.

PostgREST v14.5, the version in production, treats 40001 as a transaction to run again. It repeats
it without limit and without answering. A serialization failure normally clears on the next attempt.
This refusal does not, because the same request meets the same mismatch every time. So the browser
waited forever, and the loop kept running in the database after the client had gone, until its
backend was terminated.

The stacks the tests ran on used PostgREST v16.2, which returns the error at once. Every test
asserting 40001 passed there.

## Decision

`close_period` raises its own SQLSTATE, `CG001`, for a stale plan. PostgREST returns it as HTTP 400
with the code in the body. A code of our own means what we say it means, in any PostgREST version.

Database functions must not raise SQLSTATE class 40 on purpose. That class is the server's way of
saying "run this again", and an expected business refusal is the opposite.

CI pins PostgREST to production's version and fails if the stack starts with another one. Local
stacks follow `supabase/.temp/rest-version`, which `supabase link` writes, once their containers
are recreated.

## Consequences

- A stale plan reaches the user as a message, and refusing never holds a connection.
- The app and the function agree on a code that only this project uses, so renaming it takes a
  migration and a code change together.
- The pin is a value in `ci.yml` that nothing compares with production, because CI never talks to
  the remote project. When production's PostgREST moves, someone has to update it.
