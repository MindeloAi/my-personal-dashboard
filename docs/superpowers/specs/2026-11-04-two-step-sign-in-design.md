# Two-step sign-in — design

**Date:** 2026-11-04
**Status:** approved in conversation, awaiting spec review

## Goal

A stolen password alone must not open `/admin` or the Claude connector. Every admin
account (`admin@`, `michaeltaylorwalker@`, `zaneadams@mindelo.site`) signs in with
email + password **and** a 6-digit code from an authenticator app.

## Decisions

- **Supabase Auth MFA, TOTP factor.** Built into `@supabase/supabase-js` 2.112 (already
  installed); no new dependency, no secrets stored by us.
- **Required for every admin.** An admin with no authenticator yet is sent to set one up;
  there is no "skip".
- **`admin@mindelo.site` is shared.** At setup both Michael and Zane scan the same QR code,
  so either can produce its codes. Personal accounts are set up on their owner's phone.
- **Lost phone:** `scripts/reset-2fa.mjs <email>` (service role key, run from a founder's
  computer) deletes that account's factors; the next sign-in shows a new QR code. No
  recovery codes.
- **Not in scope:** passkeys, re-asking for a code on sensitive pages, sign-in alerts,
  login rate limiting. Separate follow-ups.

## Flow

1. `/login`: email + password, as today. On success:
   - no verified factor → `/login/setup`
   - verified factor, session at `aal1` → `/login/code`
   - already `aal2` → `next` or `/admin/overview`
2. `/login/setup`: enrols a TOTP factor (`mfa.enroll`), shows the QR code and the text
   secret, asks for one code (`mfa.challengeAndVerify`). Success upgrades the session to
   `aal2` and continues to `next`. A setup abandoned half way leaves an unverified factor,
   which is removed before the next enrol attempt.
3. `/login/code`: one input, `mfa.challengeAndVerify`. Wrong code → "That code didn't
   work. Try the newest one." Supabase rate-limits verification attempts.
4. The `next` parameter (already validated by `safeNext`) is carried through steps 2 and 3,
   so the Claude consent page returns to itself after the code.

## Enforcement (one rule, one place)

- `getAdmin()` in `src/lib/auth.ts` returns an admin only when, in addition to the
  existing profile + `ADMIN_EMAILS` checks, the verified session's assurance level is
  `aal2` (`mfa.getAuthenticatorAssuranceLevel().currentLevel`, read after `getUser()` has
  validated the same session). Everything that already calls `getAdmin` /
  `requireAdmin` / `requireAdminPage` — every admin page and layout, every mutating
  server action, the PDF, file and export routes, and `/oauth/authorize` — inherits it.
- A second helper, `getPendingAdmin()`, is the same checks **without** the `aal2`
  requirement. Only the login, setup and code pages use it.
- `src/proxy.ts`: a session at `aal1` visiting `/admin/*` is redirected to `/login/code`
  (or `/login/setup` when no factor exists) instead of being let through to a page that
  would bounce it.
- Claude connector: `/oauth/authorize` requires `aal2` through `getAdmin`, so a new
  connection needs a code. Existing connector tokens keep working until they expire or
  are disconnected; the access/refresh checks stay as they are (profile + email list).

## Errors

- Supabase unreachable during setup/verify → "Couldn't check that code. Try again." No
  fallback that skips the code.
- Enrol fails (e.g. MFA disabled on the project) → setup page shows the error plainly;
  the admin cannot get in, by design. Fix is in Supabase settings.

## Testing

- Unit: the redirect decision (`no factor → setup`, `aal1 → code`, `aal2 → next`) as a
  pure function with assert checks.
- `getAdmin` refuses an `aal1` session and accepts `aal2` (stubbed Supabase client).
- Manual on production after deploy: each of the three accounts signs in once, sets up
  its authenticator, signs out, signs in again with a code; reconnect Claude as `admin@`.

## Rollout

Merge deploys. Before merging, both founders should be ready to set up their phones; the
first sign-in after deploy for each account goes through setup. Nothing else changes for
the Claude app until it reconnects.
