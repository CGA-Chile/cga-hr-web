# 0018 — PostHog for analytics, session replay and errors

Date: 2026-10-22
Status: Accepted

## Context

The app has been in daily use since the start of October and there was no way to see how it is
used or where it fails, short of asking the users or being in the plant on Thursday. Errors in the
browser were invisible unless someone reported them, and the users who would report them are the
ones least able to describe what happened.

PostHog was installed with its setup wizard. It adds:

- `posthog-js`, initialised in `src/instrumentation-client.ts`: pageviews, autocapture, session
  replay and exception capture, with the behaviour set by the PostHog project settings.
- `posthog.identify` with the user id, username and role, in `AnalyticsIdentity`, and
  `posthog.reset` on sign-out.
- About a dozen named events on the writes that matter: an assignment saved, a range applied, a
  period closed, a review item acknowledged, an employee or position saved.
- `src/app/global-error.tsx`, which reports render errors that escape every other boundary.
- Server logs for report exports, sent to PostHog over OpenTelemetry from the two export routes.

## Decision

Keep PostHog, with the defaults the wizard and the PostHog project chose. Autocapture keeps
element text and session replay records the screen with only inputs masked.

Without `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`, nothing initialises and every
capture call is a no-op. The wizard made the missing variables throw in development; that was
removed, because a fresh clone of a public repository has to run without an analytics account.

The project token is public by design, like the Supabase `anon` key: it can only send events, not
read them. It lives in Vercel's environment and in `.env.local`, never in source.

## Consequences

- Real worker names and bonus amounts reach PostHog through autocapture text and session replay.
  The data leaves Supabase and is held by a third party under PostHog's retention settings. This
  was chosen knowingly; masking all text in replays and disabling autocapture text is a project
  setting plus two `posthog.init` options, and is the first thing to revisit if that becomes a
  concern.
- Events named `*_submitted` fire when the form is submitted, before the server answers, so they
  count attempts. The others fire only after the write succeeded.
- The OpenTelemetry exporter adds four dependencies for one log line per export. If those logs turn
  out not to be read, a `posthog.capture` on the download link replaces them.
