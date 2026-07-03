# Plan: "Vault" section in the personal dashboard (Obsidian front-end)

> Saved 2026-07-03. A visual front-end for the Obsidian vault, merged into the existing
> personal dashboard. Pick this up later — hand it to Claude Code and say "execute VAULT-SECTION-PLAN.md".

## Context

The user keeps a structured Obsidian vault (`C:\Users\taylo\OneDrive\Documents\MY VAULT`)
that acts as an index/reference layer over all their projects: ~40 project notes under
`01 - Projects/` (Clients + Agents), each with rich YAML frontmatter (`type`, `status`,
`category`, `client`, `stack`, `deploy_url`, `github`, `last_touched`, `tags`), plus
`Daily Notes/` that log activity via `[[wiki-links]]`. Obsidian renders this as plain
tables; the user wants a **nicer visual dashboard** of it.

Decision (from brainstorming): **fully merge** this into the existing personal dashboard
(`C:\Users\taylo\my-personal-dashboard`, app in `business-dashboard/`, Next.js 16 +
shadcn + Tailwind v4, Vercel) as a new section called **"Vault"**, showing **project
cards + recent activity + filters/search**. No full note-body reading, no auth, no
Airtable duplication.

The key constraint: Vercel is serverless and cannot read the local OneDrive vault at
runtime. So a **local sync script** extracts just the needed data into a committed JSON
file, and a **Windows Scheduled Task runs it hourly** (commit + push → Vercel redeploys).
Intended outcome: a seamless in-dashboard visual index of the vault that stays current
automatically.

## Approach

Add a data pipeline (local extract → committed `vault.json`) and two new dashboard
sections that read that JSON via a typed `lib/vault.ts`, mirroring the existing
`lib/airtable.ts` → server-component → `dashboard-shell` pattern.

### 1. Sync script (new) — `business-dashboard/scripts/sync-vault.mjs`
- Add dependency **`gray-matter`** (frontmatter parsing). `zod` already present.
- Read `VAULT_PATH` (default `C:\Users\taylo\OneDrive\Documents\MY VAULT`).
- **Projects:** glob `01 - Projects/**/*.md`, **skip** the auto-generated ` — GitHub.md`
  siblings. Parse frontmatter with `gray-matter`; emit `{ name, status, category, client,
  stack[], deploy_url, github, last_touched, tags[] }`. Rely on the main note's
  frontmatter for `github`/`deploy_url` (the GitHub sibling is not needed for this view).
- **Activity:** read last ~14 `Daily Notes/*.md`; extract dated `[[wiki-link]]` touches
  and "Decisions" lines → `{ date, project, note }[]`, newest first.
- Write **`business-dashboard/src/data/vault.json`** = `{ syncedAt, projects, activity }`.
- Keep it dependency-light and pure-Node (ESM `.mjs`), runnable via `node scripts/sync-vault.mjs`.

### 2. Scheduled task (new) — `business-dashboard/scripts/sync-vault.ps1`
- Wrapper: run `node scripts/sync-vault.mjs`, then if `src/data/vault.json` changed,
  `git add src/data/vault.json && git commit -m "chore: sync vault" && git push`.
- **Verify the deploy trigger**: if the repo is GitHub-connected on Vercel, push
  auto-deploys; if not, append `vercel --prod` (cwd `business-dashboard`) to the wrapper.
- Register hourly via `schtasks /create /tr "...sync-vault.ps1" /sc hourly` (documented
  command in the script header; the user runs it once to install).

### 3. Data reader (new) — `business-dashboard/src/lib/vault.ts`
- `import vaultData from "@/data/vault.json"` (or `fs` read), validate with a `zod`
  schema (`VaultProjectSchema`, `VaultActivitySchema`) exactly like `airtable.ts`.
- Export `getVaultProjects()`, `getVaultActivity()`, `getVaultSyncedAt()`.

### 4. UI (new components) — `business-dashboard/src/components/dashboard/`
- `vault-projects.tsx` — **client component** (holds filter/search state). Props: full
  projects array. Renders a responsive card grid (shadcn `Card`/`Badge`/`Button`): name,
  status pill, category, client, stack tags, live-URL + GitHub link buttons. Filter chips
  for status / category / stack (shadcn `Select` or toggle chips) + a text `Input`
  searching name + client. All client-side over ~40 items.
- `vault-activity.tsx` — recent-activity timeline from `getVaultActivity()`.

### 5. Wire into the single dashboard page (modify)
- `src/app/(dashboard)/dashboard/page.tsx` — add `getVaultProjects()`/`getVaultActivity()`
  to the existing `Promise.all`, pass into `DashboardShell`.
- `src/components/dashboard/dashboard-shell.tsx` — add a `<Section id="vault" ...>`
  wrapping `<VaultProjects>` + `<VaultActivity>` (reuse the existing `Section` component).
- `src/components/dashboard/sidebar.tsx` — add a **"Vault"** nav anchor (scrolls to
  `#vault`), placed near the existing "Projects" item.
- `package.json` — add `"sync-vault": "node scripts/sync-vault.mjs"` script + `gray-matter`.

## Files to create / modify

Create:
- `business-dashboard/scripts/sync-vault.mjs`
- `business-dashboard/scripts/sync-vault.ps1`
- `business-dashboard/src/data/vault.json` (generated; commit the first run)
- `business-dashboard/src/lib/vault.ts`
- `business-dashboard/src/components/dashboard/vault-projects.tsx`
- `business-dashboard/src/components/dashboard/vault-activity.tsx`

Modify:
- `business-dashboard/src/app/(dashboard)/dashboard/page.tsx`
- `business-dashboard/src/components/dashboard/dashboard-shell.tsx`
- `business-dashboard/src/components/dashboard/sidebar.tsx`
- `business-dashboard/package.json`

## Reuse (don't reinvent)
- Follow `src/lib/airtable.ts` for the lazy-load + zod-validate + typed-getter pattern.
- Reuse the existing `Section` component and shadcn primitives in `components/ui/`
  (`card`, `badge`, `button`, `input`, `select`) and the dark hex palette already used
  in `dashboard-shell.tsx` (`#0b0d10`, `#14181d`, accent `#fbbf24`) so it's seamless.
- Mirror the mental model of the existing `_sync/manifest.tsv` + `gh-snapshot.sh` flow
  the user already trusts.

## Verification
1. **Sync:** run `npm run sync-vault` in `business-dashboard/`; confirm `src/data/vault.json`
   contains ~40 projects with correct frontmatter fields and a populated activity list.
2. **Local render:** `npm run dev`, open `/dashboard`, scroll to the **Vault** section
   (or click the sidebar "Vault" anchor). Verify cards show status/stack/links, filters +
   search narrow the grid instantly, and the activity timeline lists recent daily-note touches.
3. **Build:** `npm run build` passes (JSON import works on Vercel's read-only FS).
4. **Deploy:** push (or `vercel --prod`); confirm the live dashboard shows the Vault section.
5. **Automation:** register the scheduled task, force-run it once
   (`schtasks /run /tn ...`), and confirm it produces a commit and a redeploy.

## Out of scope (YAGNI)
Full markdown note-body rendering, wikilink/backlink graph, auth/passcode gate, Airtable
mirroring of vault data. All are additive later if wanted.

## Decisions locked during brainstorming
- Purpose: nicer visual dashboard of the vault (not a public portfolio, not full note-reader).
- Architecture: fully merged into the existing personal dashboard, one screen.
- Content: project cards + recent activity + filters/search (no full note reading).
- Refresh: automatic, hourly, via Windows scheduled task.
- Section name: **Vault**.
