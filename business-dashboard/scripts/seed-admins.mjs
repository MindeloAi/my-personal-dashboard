// seed-admins.mjs  Create the founder accounts and their admin profiles.
//
// Public signup is disabled at the Supabase project level, so accounts cannot be
// created through the API by anyone. This script uses the service role key to
// create them directly, which is the only route in. Run it once.
//
// Passwords are generated here and printed ONCE to the terminal. They are not
// written to disk and not committed. Copy them into a password manager
// immediately; there is no reset flow, so a lost password means re-running this
// with --reset for that address.
//
// Run:  node --env-file=.env.local scripts/seed-admins.mjs [--reset]
// Env:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DIRECT_URL

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { randomBytes } from "node:crypto";

const ADMINS = [
  "admin@mindelo.site",
  "zaneadams@mindelo.site",
  "michaeltaylorwalker@mindelo.site",
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DIRECT_URL;
if (!url || !serviceKey || !dbUrl) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DIRECT_URL.");
  process.exit(1);
}

const reset = process.argv.includes("--reset");

// --password <value> sets an explicit password for every account instead of
// generating one. Chosen deliberately by the founders; anything typed here is
// only as strong as they make it.
const pwFlag = process.argv.indexOf("--password");
const fixedPassword = pwFlag !== -1 ? process.argv[pwFlag + 1] : null;

// 24 bytes of base64url. Long and random enough that no rotation policy is needed.
const makePassword = () => fixedPassword ?? randomBytes(24).toString("base64url");

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(dbUrl, { prepare: false, max: 1, connect_timeout: 10, idle_timeout: 2, onnotice: () => {} });

const created = [];

try {
  const { data: existing, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;

  for (const email of ADMINS) {
    const found = existing.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    let userId;
    let password = null;

    if (found && !reset) {
      userId = found.id;
      console.log(`  exists   ${email}`);
    } else if (found && reset) {
      password = makePassword();
      const { error } = await admin.auth.admin.updateUserById(found.id, { password });
      if (error) throw error;
      userId = found.id;
      console.log(`  reset    ${email}`);
    } else {
      password = makePassword();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // no inbox round-trip; these are seeded accounts
      });
      if (error) throw error;
      userId = data.user.id;
      console.log(`  created  ${email}`);
    }

    // The profiles row is what actually grants admin. A user without one can sign
    // in but requireAdmin() will still refuse them.
    await sql`
      insert into profiles (id, email, role) values (${userId}, ${email}, 'admin')
      on conflict (id) do update set email = excluded.email, role = 'admin'
    `;

    if (password) created.push({ email, password });
  }

  const rows = await sql`select email, role from profiles order by email`;
  console.log(`\nprofiles table now holds ${rows.length} admin(s):`);
  rows.forEach((r) => console.log(`  ${r.email}  (${r.role})`));

  if (created.length) {
    console.log("\n" + "=".repeat(64));
    console.log("PASSWORDS  shown once, not stored anywhere. Copy them now.");
    console.log("=".repeat(64));
    created.forEach((c) => console.log(`  ${c.email.padEnd(34)} ${c.password}`));
    console.log("=".repeat(64));
  } else {
    console.log("\nNo new passwords generated. Use --reset to rotate an existing account.");
  }
} catch (err) {
  console.error("\nFailed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

process.exit(process.exitCode ?? 0);
