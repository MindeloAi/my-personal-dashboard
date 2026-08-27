// db-migrate.mjs — apply scripts/schema.sql to the Supabase Postgres database.
//
// Why this exists: the dashboard's Supabase project lives in an org the Supabase
// MCP connection cannot see, so schema changes are applied from a committed
// script rather than through tooling. That also keeps the schema in version
// control, which is where it belongs.
//
// Uses DIRECT_URL (session pooler, :5432) rather than DATABASE_URL (transaction
// pooler, :6543): DDL and multi-statement simple queries do not belong on the
// transaction pooler.
//
// Run:  npm run db:migrate
// Env:  DIRECT_URL   session-pooler connection string

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.DIRECT_URL;
if (!url) {
  console.error(
    "DIRECT_URL is not set. Add the Supabase *session pooler* connection string\n" +
      "(port 5432) to .env.local. Do not use db.<ref>.supabase.co — that host is\n" +
      "IPv6-only on the free tier and will not resolve from here.",
  );
  process.exit(1);
}

const ddl = readFileSync(join(__dirname, "schema.sql"), "utf8");
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

try {
  // .simple() sends the whole file as one simple-protocol query, which is the
  // only way to run multiple DDL statements in a single round trip.
  await sql.unsafe(ddl).simple();

  const tables = await sql`
    select table_name
      from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name
  `;
  const views = await sql`
    select table_name
      from information_schema.views
     where table_schema = 'public'
     order by table_name
  `;

  console.log(`Applied schema.sql.`);
  console.log(`  tables: ${tables.map((t) => t.table_name).join(", ")}`);
  console.log(`  views:  ${views.map((v) => v.table_name).join(", ")}`);
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
