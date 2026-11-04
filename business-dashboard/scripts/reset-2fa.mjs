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
