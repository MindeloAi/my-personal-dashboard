// cleanup.test.ts — checks for migration 019 (links, invoice numbering) and
// the lead→client conversion. Runs against a THROWAWAY database only; see the
// "Throwaway database" block in docs/superpowers/plans/2026-10-28-data-cleanup.md,
// then also apply 019:
//   DIRECT_URL=$U node scripts/run-migration.mjs scripts/migrations/019_links_and_numbering.up.sql
//   DATABASE_URL=$U bun scripts/cleanup.test.ts

import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost. This script deletes data.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 4, onnotice: () => {} });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}
async function refused(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function reset() {
  await sql.begin(async (tx) => {
    await tx`delete from payments`;
    await tx`delete from cash_movements where kind <> 'opening'`;
    await tx`delete from invoices`;
    await tx`delete from projects`;
    await tx`delete from leads`;
    await tx`delete from clients`;
  });
}

const inv = async (status: string, number: string | null = null) =>
  String((await sql`
    insert into invoices (invoice_number, amount, status, issue_date)
    values (${number}, 100, ${status}, '2026-10-28') returning id`)[0].id);
const numberOf = async (id: string) =>
  (await sql`select invoice_number from invoices where id = ${id}`)[0].invoice_number as string | null;

try {
  // 1 — a draft has no number; sending it assigns the next INV-####.
  await reset();
  {
    await inv("Paid", "INV-0007");
    const d = await inv("Draft");
    check("1 a draft gets no number", (await numberOf(d)) === null);
    await sql`update invoices set status = 'Sent' where id = ${d}`;
    check("  sending it assigns the next number after the highest INV-####", (await numberOf(d)) === "INV-0008", String(await numberOf(d)));
    const s = await inv("Sent");
    check("  creating one as Sent numbers it straight away", (await numberOf(s)) === "INV-0009", String(await numberOf(s)));
  }

  // 2 — numbers never change once given, even when voided.
  await reset();
  {
    const s = await inv("Sent");
    await sql`update invoices set status = 'Void' where id = ${s}`;
    check("2 voiding keeps the number", (await numberOf(s)) === "INV-0001");
    const msg = await refused(() => sql`update invoices set invoice_number = 'X-1' where id = ${s}`);
    check("  changing an issued number is refused", !!msg?.includes("already has its number"), String(msg));
    const cleared = await refused(() => sql`update invoices set invoice_number = null where id = ${s}`);
    check("  clearing it is refused too", !!cleared?.includes("already has its number"), String(cleared));
    const renumbered = await refused(() => sql.begin(async (tx) => {
      await tx`select set_config('invoices.renumber', 'on', true)`;
      await tx`update invoices set invoice_number = 'INV-0042' where id = ${s}`;
    }));
    check("  with invoices.renumber on, an issued number can be changed",
      renumbered === null && (await numberOf(s)) === "INV-0042", String(renumbered ?? await numberOf(s)));
  }

  // 3 — the advisory lock makes a second numbering wait for the first to commit.
  await reset();
  {
    const a = await sql.reserve();
    const b = await sql.reserve();
    try {
      await a`begin`;
      await a`insert into invoices (amount, status, issue_date) values (100, 'Sent', '2026-10-28')`;
      await b`begin`;
      const bInsert = b`insert into invoices (amount, status, issue_date) values (100, 'Sent', '2026-10-28') returning invoice_number`;
      const raced = await Promise.race([
        bInsert.then(() => "finished"),
        new Promise((r) => setTimeout(() => r("blocked"), 300)),
      ]);
      check("3 a second Sent invoice waits while the first is uncommitted", raced === "blocked", String(raced));
      await a`commit`;
      const [row] = await bInsert;
      await b`commit`;
      check("  once the first commits, the second gets the next number", row.invoice_number === "INV-0002", String(row.invoice_number));
    } finally {
      await a`rollback`.catch(() => {});
      await b`rollback`.catch(() => {});
      a.release();
      b.release();
    }
  }

  // 3b — smoke test: eight invoices sent at once never share a number.
  await reset();
  {
    const ids = await Promise.all(Array.from({ length: 8 }, () => inv("Sent")));
    const nums = await Promise.all(ids.map(numberOf));
    check("3b eight invoices created together get eight different numbers", new Set(nums).size === 8, nums.join(","));
  }

  // 4 — the new link columns exist with the right defaults.
  await reset();
  {
    const [l] = await sql`insert into leads (name, status) values ('Test lead', 'New') returning id`;
    const [p] = await sql`insert into projects (name, lead_id) values ('Test project', ${l.id}) returning lead_id, internal, client_id`;
    check("4 a project can belong to a lead and is not internal by default",
      String(p.lead_id) === String(l.id) && p.internal === false && p.client_id === null);
    const [c] = await sql`insert into clients (name) values ('Test client') returning id`;
    await sql`update leads set client_id = ${c.id} where id = ${l.id}`;
    await sql`delete from leads where id = ${l.id}`;
    const [after] = await sql`select lead_id from projects where name = 'Test project'`;
    check("  deleting the lead leaves the project, unlinked", after.lead_id === null);
  }

  await reset();
} finally {
  await sql.end();
}

console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
