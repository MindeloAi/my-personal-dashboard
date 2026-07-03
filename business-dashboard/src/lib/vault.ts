import { z } from "zod";
import vaultData from "@/data/vault.json";

// ─── Vault reader ──────────────────────────────────────────────────────────────
//
// The Obsidian vault lives on the local machine and can't be read from Vercel's
// serverless runtime. `scripts/sync-vault.mjs` extracts a compact view into the
// committed `src/data/vault.json`; this module validates that JSON and exposes
// typed getters, mirroring the lazy-validate pattern in `lib/airtable.ts`.
//
// Validation runs once at module load (the JSON is a static import). A malformed
// entry is dropped with a warning rather than crashing the dashboard.

export const VaultProjectSchema = z.object({
  name: z.string(),
  folder: z.string().default(""),
  status: z.string().default(""),
  category: z.string().default(""),
  client: z.string().default(""),
  stack: z.array(z.string()).default([]),
  deploy_url: z.string().default(""),
  github: z.string().default(""),
  created: z.string().default(""),
  last_touched: z.string().default(""),
  tags: z.array(z.string()).default([]),
});
export type VaultProject = z.infer<typeof VaultProjectSchema>;

export const VaultActivitySchema = z.object({
  date: z.string(),
  project: z.string().default(""),
  note: z.string().default(""),
  kind: z.enum(["touch", "decision"]).default("touch"),
});
export type VaultActivity = z.infer<typeof VaultActivitySchema>;

const VaultDataSchema = z.object({
  syncedAt: z.string(),
  projects: z.array(z.unknown()),
  activity: z.array(z.unknown()),
});

/** Validate each element, dropping (with a warning) any that fail the schema. */
function parseList<T>(label: string, items: unknown[], schema: z.ZodType<T>): T[] {
  const out: T[] = [];
  for (const item of items) {
    const result = schema.safeParse(item);
    if (result.success) out.push(result.data);
    else console.warn(`[vault] dropped ${label} entry`, result.error.issues);
  }
  return out;
}

const parsed = VaultDataSchema.safeParse(vaultData);

const projects: VaultProject[] = parsed.success
  ? parseList("project", parsed.data.projects, VaultProjectSchema)
  : [];
const activity: VaultActivity[] = parsed.success
  ? parseList("activity", parsed.data.activity, VaultActivitySchema)
  : [];
const syncedAt: string = parsed.success ? parsed.data.syncedAt : "";

if (!parsed.success) {
  console.warn("[vault] vault.json failed top-level validation", parsed.error.issues);
}

export function getVaultProjects(): VaultProject[] {
  return projects;
}

export function getVaultActivity(): VaultActivity[] {
  return activity;
}

export function getVaultSyncedAt(): string {
  return syncedAt;
}
