// run-migration.mjs — apply one migration file, against a chosen schema.
//
// Why this exists: scripts/schema.sql is the idempotent full-schema definition
// and cannot express a reversible step. Migrations under scripts/migrations/
// come in .up.sql / .down.sql pairs and are applied one at a time by this
// runner, which reports exactly which rows each statement touched.
//
// The --schema flag is what makes a rehearsal possible. Migration SQL uses
// UNQUALIFIED table names, so the same file runs against a scratch copy
// (--schema sandbox) and then against the real table (--schema public) with
// no edit in between.
//
// Everything runs in ONE transaction. Any error rolls the whole file back.
//
// Usage:
//   node --env-file=.env.local scripts/run-migration.mjs <file> [--schema public] [--dry-run]
//
// --dry-run executes inside the transaction, prints what changed, then ROLLS
// BACK. Nothing is persisted.
//
// Env: DIRECT_URL (session pooler, :5432)

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const schema = (args.find((a) => a.startsWith("--schema=")) ?? "--schema=public").split("=")[1];
const dryRun = args.includes("--dry-run");

if (!file) {
  console.error("Usage: run-migration.mjs <file.sql> [--schema=public] [--dry-run]");
  process.exit(1);
}
const path = resolve(file);
if (!existsSync(path)) {
  console.error(`No such file: ${path}`);
  process.exit(1);
}
const url = process.env.DIRECT_URL;
if (!url) {
  console.error("DIRECT_URL is not set. See .env.local.example.");
  process.exit(1);
}

// Strip comments, then split on statement terminators. The migration SQL in
// this repo contains no semicolons inside string literals, so a plain split is
// safe here; if that ever changes this needs a real parser.
const raw = readFileSync(path, "utf8");
const statements = raw
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const sql = postgres(url, {
  prepare: false,
  max: 1,
  connect_timeout: 10,
  idle_timeout: 2,
  onnotice: () => {},
});

console.log(`file:   ${file}`);
console.log(`schema: ${schema}`);
console.log(`mode:   ${dryRun ? "DRY RUN (will roll back)" : "APPLY"}\n`);

let failed = false;
try {
  await sql.begin(async (tx) => {
    await tx.unsafe(`set local search_path = ${schema}`);

    for (const [i, stmt] of statements.entries()) {
      const label = stmt.split("\n")[0].slice(0, 68);
      const rows = await tx.unsafe(stmt);
      const verb = stmt.trim().split(/\s+/)[0].toLowerCase();

      if (verb === "update" || verb === "insert" || verb === "delete") {
        console.log(`[${i + 1}] ${label}…`);
        console.log(`    rows touched: ${rows.length ?? rows.count ?? 0}`);
        for (const r of rows) {
          console.log(`      ${JSON.stringify(r)}`);
        }
      } else {
        console.log(`[${i + 1}] ${label}…  ok`);
      }
    }

    if (dryRun) {
      throw new Error("__DRY_RUN_ROLLBACK__");
    }
  });
  console.log(`\nApplied to schema "${schema}".`);
} catch (err) {
  if (err.message === "__DRY_RUN_ROLLBACK__") {
    console.log("\nDry run complete — transaction rolled back, nothing persisted.");
  } else {
    console.error(`\nFAILED (rolled back): ${err.message}`);
    failed = true;
  }
} finally {
  await sql.end({ timeout: 5 });
}

process.exit(failed ? 1 : 0);
