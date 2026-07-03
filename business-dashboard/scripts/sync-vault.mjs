// sync-vault.mjs — extract a compact view of the Obsidian vault into a committed JSON
// file the dashboard can read at runtime.
//
// Why this exists: Vercel is serverless and cannot read the local OneDrive vault at
// request time. So we extract *just* the fields the Vault section needs into
// src/data/vault.json, commit it, and let a scheduled task keep it fresh (see
// sync-vault.ps1). Pure Node, ESM, one dependency (gray-matter) for frontmatter.
//
// Run:  node scripts/sync-vault.mjs        (from business-dashboard/)
// Env:  VAULT_PATH   override the vault root (default = Taylor's OneDrive vault)

import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = dirname(fileURLToPath(import.meta.url));

const VAULT_PATH =
  process.env.VAULT_PATH || "C:\\Users\\taylo\\OneDrive\\Documents\\MY VAULT";

const PROJECTS_DIR = join(VAULT_PATH, "01 - Projects");
const DAILY_DIR = join(VAULT_PATH, "Daily Notes");
const OUT_FILE = join(__dirname, "..", "src", "data", "vault.json");

// How many of the most recent daily notes to scan for activity.
const DAILY_LOOKBACK = 14;

// ─── Small fs helpers ─────────────────────────────────────────────────────────

/** Recursively collect *.md files under a dir. Returns [] if the dir is absent. */
function walkMarkdown(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(full));
    else if (entry.isFile() && extname(entry.name) === ".md") out.push(full);
  }
  return out;
}

/** Normalize a frontmatter value that should be a string[] (Obsidian YAML lists). */
function toStringArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

/** Normalize a scalar frontmatter value to a trimmed string, or "" if empty/absent. */
function toStr(value) {
  if (value === null || value === undefined) return "";
  // YAML auto-parses bare dates (e.g. `2026-05-20`) into JS Date objects (stored as
  // UTC midnight). Recover the original calendar date via UTC parts so it renders as
  // a clean YYYY-MM-DD regardless of the machine's timezone.
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).trim();
}

// ─── Projects ─────────────────────────────────────────────────────────────────
//
// One curated main note per project + an auto-generated "<Project> — GitHub.md"
// snapshot sibling we must skip (the main note carries the durable frontmatter).

function extractProjects() {
  const files = walkMarkdown(PROJECTS_DIR).filter(
    (f) => !basename(f).endsWith(" — GitHub.md"),
  );

  const projects = [];
  for (const file of files) {
    let parsed;
    try {
      parsed = matter(readFileSync(file, "utf8"));
    } catch (err) {
      console.warn(`[sync-vault] skipped unparseable note: ${file} (${err.message})`);
      continue;
    }
    const fm = parsed.data || {};

    // Only real project notes (frontmatter type: project). Guards against stray
    // notes that happen to live under 01 - Projects.
    if (toStr(fm.type) && toStr(fm.type) !== "project") continue;

    const name = basename(file, ".md");
    // Folder under 01 - Projects (Agents | Clients) — a useful coarse grouping.
    const folder = basename(dirname(file));

    projects.push({
      name,
      folder,
      status: toStr(fm.status),
      category: toStr(fm.category),
      client: toStr(fm.client),
      stack: toStringArray(fm.stack),
      deploy_url: toStr(fm.deploy_url),
      github: toStr(fm.github),
      created: toStr(fm.created),
      last_touched: toStr(fm.last_touched),
      tags: toStringArray(fm.tags),
    });
  }

  // Newest-touched first; fall back to name for undated notes.
  projects.sort((a, b) => {
    const t = (b.last_touched || "").localeCompare(a.last_touched || "");
    return t !== 0 ? t : a.name.localeCompare(b.name);
  });

  return projects;
}

// ─── Activity ─────────────────────────────────────────────────────────────────
//
// Daily notes log work as `- [[Project]] — note` lines under "## Touched projects"
// and `**Decision:** …` lines under "## Notes". We surface both as a flat, dated
// timeline (newest first).

const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/; // first [[link]] on a line
const DECISION_RE = /\*\*Decisions?:?\*\*[\s:]*(.+)/i;

function extractActivity() {
  const files = walkMarkdown(DAILY_DIR)
    // Daily notes are named YYYY-MM-DD.md, so filename sort = chronological.
    .sort((a, b) => basename(b).localeCompare(basename(a)))
    .slice(0, DAILY_LOOKBACK);

  const activity = [];
  for (const file of files) {
    let parsed;
    try {
      parsed = matter(readFileSync(file, "utf8"));
    } catch (err) {
      console.warn(`[sync-vault] skipped unparseable daily note: ${file} (${err.message})`);
      continue;
    }
    const date = toStr(parsed.data?.date) || basename(file, ".md");
    const lines = parsed.content.split(/\r?\n/);

    let section = null; // "touched" | "notes" | null
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith("## ")) {
        const heading = line.slice(3).toLowerCase();
        if (heading.includes("touched")) section = "touched";
        else if (heading.includes("note")) section = "notes";
        else section = null;
        continue;
      }

      if (section === "touched" && line.startsWith("-")) {
        const link = line.match(WIKILINK_RE);
        if (!link) continue;
        const project = link[1].trim();
        // Everything after the "— " em-dash is the note; strip leading list/link syntax.
        const dashIdx = line.indexOf("—");
        const note = dashIdx !== -1 ? line.slice(dashIdx + 1).trim() : "";
        activity.push({ date, project, note, kind: "touch" });
      } else if (section === "notes") {
        const decision = line.match(DECISION_RE);
        if (decision) {
          const text = decision[1].trim();
          const link = text.match(WIKILINK_RE);
          activity.push({
            date,
            project: link ? link[1].trim() : "",
            note: text,
            kind: "decision",
          });
        }
      }
    }
  }

  // Already newest-first by daily-note order; keep it stable.
  return activity;
}

// ─── Write ────────────────────────────────────────────────────────────────────

function main() {
  const vaultExists = (() => {
    try {
      return statSync(VAULT_PATH).isDirectory();
    } catch {
      return false;
    }
  })();

  if (!vaultExists) {
    console.error(
      `[sync-vault] VAULT_PATH not found: ${VAULT_PATH}\n` +
        `Set VAULT_PATH to your vault root and re-run. Not overwriting ${OUT_FILE}.`,
    );
    process.exit(1);
  }

  const projects = extractProjects();
  const activity = extractActivity();

  // syncedAt is passed in when the scheduled task runs so the JSON is deterministic
  // for a given moment; falls back to now for manual runs.
  const syncedAt = process.env.SYNC_STAMP || new Date().toISOString();

  const payload = { syncedAt, projects, activity };

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(
    `[sync-vault] wrote ${OUT_FILE}\n` +
      `  projects: ${projects.length}\n` +
      `  activity: ${activity.length} entries from up to ${DAILY_LOOKBACK} daily notes`,
  );
}

main();
