# Two-Step Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every admin signs in with password + a 6-digit authenticator code; nothing admin-only works on a password-only session.

**Architecture:** Supabase Auth MFA (TOTP). `getAdmin()` additionally requires the session's assurance level to be `aal2`; a new `getPendingAdmin()` (no `aal2`) is used only by the login, setup and code pages. `requireAdminPage()` sends a half-signed-in founder to the setup or code page. A pure `nextStep()` decides where a signed-in founder goes.

**Tech Stack:** Next.js 16 (server components + server actions, `useActionState`), `@supabase/ssr` 0.12, `@supabase/supabase-js` 2.112, bun assert tests.

Spec: `docs/superpowers/specs/2026-11-04-two-step-sign-in-design.md`. Deviation from spec: the edge proxy is unchanged; `requireAdminPage()` (called by the admin layout and every admin page) does the aal1 redirect instead.

All paths below are under `business-dashboard/`.

---

### Task 1: `nextStep()` — where a signed-in founder goes

**Files:**
- Create: `src/lib/mfa.ts`
- Test: `scripts/mfa.test.ts`

- [ ] **Step 1: Write the failing test** — `scripts/mfa.test.ts`

```ts
// mfa.test.ts — where a signed-in founder goes next. No database.
//   bun scripts/mfa.test.ts
import assert from "node:assert/strict";
import { nextStep } from "../src/lib/mfa";

assert.equal(nextStep({ currentLevel: "aal2", nextLevel: "aal2" }), "done");
assert.equal(nextStep({ currentLevel: "aal1", nextLevel: "aal2" }), "code");
assert.equal(nextStep({ currentLevel: "aal1", nextLevel: "aal1" }), "setup");
assert.equal(nextStep({ currentLevel: null, nextLevel: null }), "setup");
console.log("All mfa checks pass");
```

- [ ] **Step 2: Run, expect FAIL** — `bun scripts/mfa.test.ts` → cannot find module `../src/lib/mfa`.

- [ ] **Step 3: Implement** — `src/lib/mfa.ts`

```ts
// Two-step sign-in. Pure, so it can be tested without Supabase.

export type Step = "done" | "code" | "setup";
type Aal = { currentLevel: string | null; nextLevel: string | null };

/**
 * done: password and code both given this session.
 * code: an authenticator is set up, the code is still owed.
 * setup: no authenticator yet; every admin must set one up.
 */
export function nextStep(aal: Aal): Step {
  if (aal.currentLevel === "aal2") return "done";
  if (aal.nextLevel === "aal2") return "code";
  return "setup";
}

export const STEP_PATH: Record<Exclude<Step, "done">, string> = { code: "/login/code", setup: "/login/setup" };
```

- [ ] **Step 4: Run, expect PASS** — `bun scripts/mfa.test.ts` → `All mfa checks pass`.

- [ ] **Step 5: Commit** — `git commit -m "feat(auth): nextStep for two-step sign-in"`

### Task 2: enforce `aal2` in `getAdmin`

**Files:** Modify `src/lib/auth.ts` (getAdmin, requireAdminPage; add getPendingAdmin)

- [ ] **Step 1: Replace `getAdmin` with `getPendingAdmin` + `getAdmin`**

```ts
/**
 * The signed-in admin and the sign-in step they are at, or null when there is no
 * admin session at all. Only the login, setup and code pages may use this: it does
 * NOT require the authenticator code. Everything else uses getAdmin().
 */
export async function getPendingAdmin(): Promise<{ admin: AdminUser; step: Step } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const profile = await getAdminProfile(user.id);
  if (!profile) return null;

  // getUser() above has validated this same session, so its aal claim can be trusted.
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return null;
  return { admin: profile, step: nextStep(data) };
}

/**
 * The signed-in admin, or null. Requires the password AND the authenticator code
 * (session assurance level aal2). Every admin page, action and route goes through here.
 */
export async function getAdmin(): Promise<AdminUser | null> {
  const p = await getPendingAdmin();
  return p?.step === "done" ? p.admin : null;
}
```

Keep the existing doc comment text about getUser vs getSession on `getPendingAdmin`. Import `nextStep, STEP_PATH, type Step` from `@/lib/mfa`.

- [ ] **Step 2: `requireAdminPage` sends a half-signed-in founder to the right step**

```ts
export async function requireAdminPage(): Promise<AdminUser> {
  const p = await getPendingAdmin();
  if (p?.step === "done") return p.admin;
  if (p) redirect(STEP_PATH[p.step]);
  redirect("/login?error=unauthorised");
}
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` → only the pre-existing `scripts/export.test.ts` error.

- [ ] **Step 4: Commit** — `git commit -m "feat(auth): admin access needs the authenticator code"`

### Task 3: login page routes by step

**Files:** Modify `src/app/login/page.tsx`

- [ ] **Step 1:** In `signIn`, replace the `getAdmin()` block and final redirect:

```ts
  const pending = await getPendingAdmin();
  if (!pending) {
    await supabase.auth.signOut();
    redirect(`/login?error=unauthorised${keep}`);
  }
  if (pending.step !== "done") redirect(`${STEP_PATH[pending.step]}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  redirect(next ?? "/admin/overview");
```

- [ ] **Step 2:** In `LoginPage`, replace the "already signed in" block the same way (pending done → next; pending code/setup → that page with `next`). Import `getPendingAdmin` instead of `getAdmin`, and `STEP_PATH` from `@/lib/mfa`.

- [ ] **Step 3: Commit** — `git commit -m "feat(auth): login continues to the code or setup step"`

### Task 4: `/login/code`

**Files:** Create `src/app/login/code/page.tsx`

Server component. Guard: `getPendingAdmin()`; null → `/login`; `done` → next; `setup` → `/login/setup`. Form posts `code` (6 digits, `inputMode="numeric"`, `autoComplete="one-time-code"`) and `next` to a server action that:

```ts
async function verify(formData: FormData) {
  "use server";
  const next = safeNext(String(formData.get("next") ?? ""));
  const keep = next ? `&next=${encodeURIComponent(next)}` : "";
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) redirect(`/login/code?error=bad${keep}`);
  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (listError || !factor) redirect(`/login/code?error=failed${keep}`);
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) redirect(`/login/code?error=bad${keep}`);
  redirect(next ?? "/admin/overview");
}
```

Messages: `bad` → "That code didn't work. Try the newest one."; `failed` → "Couldn't check that code. Try again." A "Use a different account" button posts `signOutAction`. Same card styling as `/login`.

- [ ] Commit — `git commit -m "feat(auth): code step"`

### Task 5: `/login/setup`

**Files:** Create `src/app/login/setup/page.tsx`, `src/app/login/setup/setup-form.tsx`

Page (server): guard as Task 4 but expecting `setup`. Then remove leftover unverified TOTP factors (`listFactors().all` where `factor_type === "totp" && status === "unverified"` → `unenroll`), then `mfa.enroll({ factorType: "totp", issuer: "Mindelo", friendlyName: "Authenticator " + Date.now() })`. On enrol error, render the error and a sign-out button. Otherwise render `<SetupForm factorId qr secret next action={confirm} />`.

Server action `confirm(prev, formData)` returns `{ error?: string }`: validates 6 digits, `challengeAndVerify({ factorId, code })`; error → `{ error: "That code didn't work. Try the newest one." }`; success → `redirect(next ?? "/admin/overview")`. Returning state instead of redirecting keeps the same QR code on screen after a typo.

`setup-form.tsx` (client, `useActionState`): shows the QR (`<img src={qr}>`, 200px, white background), the text secret in a monospace box for manual entry, numbered instructions ("1. Open Google Authenticator, Microsoft Authenticator or 1Password. 2. Scan this code. For admin@mindelo.site, both founders scan it now. 3. Type the 6-digit code it shows."), the code input and a Confirm button.

- [ ] Commit — `git commit -m "feat(auth): authenticator setup step"`

### Task 6: lost-phone reset script

**Files:** Create `scripts/reset-2fa.mjs`

```js
// reset-2fa.mjs  Remove an account's authenticator after a lost phone.
// The next sign-in shows a new QR code. Run from a founder's computer:
//   node --env-file=.env.local scripts/reset-2fa.mjs someone@mindelo.site
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !url || !key) {
  console.error("Usage: node --env-file=.env.local scripts/reset-2fa.mjs <email>");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } }).auth.admin;

let user = null;
for (let page = 1; !user; page++) {
  const { data, error } = await admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
  if (data.users.length < 200) break;
}
if (!user) {
  console.error(`No account for ${email}.`);
  process.exit(1);
}
const { data, error } = await admin.mfa.listFactors({ userId: user.id });
if (error) throw error;
for (const f of data.factors) {
  const { error: e } = await admin.mfa.deleteFactor({ id: f.id, userId: user.id });
  if (e) throw e;
}
console.log(`Removed ${data.factors.length} authenticator(s) from ${email}. Next sign-in sets up a new one.`);
```

- [ ] Commit — `git commit -m "feat(auth): reset-2fa script for a lost phone"`

### Task 7: verify

- [ ] `bun scripts/mfa.test.ts`; DB suites (`oauth-db`, `documents-db`, `connector-db`, `connector-tools`) against `docs-pg`; `npx tsc --noEmit`; `npx next build` (in this worktree, no dev server running).
- [ ] Grep: no remaining caller relies on `getAdmin` returning a password-only admin (`/oauth/authorize` sending a pending admin to `/login` is correct: login forwards to the code step with `next`).
- [ ] Push branch, open PR. Merge only on Michael's word.
