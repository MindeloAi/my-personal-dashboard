// ledger.test.ts — acceptance checks for the founder ledger (migration 011).
//
// Exercises the real db.ts write paths and the trigger/views against a
// THROWAWAY database. It deletes every invoice, expense and ledger row between
// checks, so it refuses to run against anything that is not localhost.
//
//   docker run -d --name ledger-pg -e POSTGRES_PASSWORD=pg -p 55432:5432 postgres:17
//   docker exec ledger-pg psql -U postgres -c "create role anon; create role authenticated;"
//   docker exec -i ledger-pg psql -U postgres < scripts/schema.sql
//   DIRECT_URL=postgres://postgres:pg@localhost:55432/postgres node scripts/run-migration.mjs scripts/migrations/011_founder_ledger.up.sql
//   DATABASE_URL=postgres://postgres:pg@localhost:55432/postgres bun scripts/ledger.test.ts

import postgres from "postgres";
import {
  getLedger,
  recordPayment,
  deletePayment,
  markPayoutPaidOut,
  undoPayoutPaidOut,
  createTransfer,
  deleteTransfer,
  createCashCount,
  deleteLatestCashCount,
  reimburseExpense,
  undoReimburseExpense,
  ledgerErrorMessage,
  closeDb,
} from "../src/lib/db";
import { holderLine, splitPreview } from "../src/lib/ledger";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost. This script deletes data.");
  process.exit(1);
}

// Same numeric/date parsing as db.ts, so values compare as numbers and "YYYY-MM-DD".
const sql = postgres(url, {
  prepare: false,
  max: 1,
  onnotice: () => {},
  types: {
    num: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    d: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
  },
});
const TODAY = "2026-10-22";
const MICHAEL = "michaeltaylorwalker@mindelo.site";
const ZANE = "zaneadams@mindelo.site";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}

async function reset() {
  await sql`delete from payments`;
  await sql`delete from cash_movements where kind <> 'opening'`;
  await sql`delete from cash_counts where note is distinct from 'Cutover count'`;
  await sql`delete from invoices`;
  await sql`delete from expenses`;
}

async function invoice(amount: number, michaelShare: number | null, extra: Record<string, unknown> = {}) {
  const [row] = await sql`
    insert into invoices ${sql({
      invoice_number: `TEST-${amount}`,
      amount,
      status: "Sent",
      issue_date: TODAY,
      due_date: TODAY,
      michael_bonus_share: michaelShare,
      zane_bonus_share: michaelShare == null ? null : 1 - michaelShare,
      ...extra,
    })} returning id`;
  return String(row.id);
}

const cash = async () => (await getLedger(TODAY)).cash;
const pay = (invoiceId: string, amount: number, o: Partial<Parameters<typeof recordPayment>[0]> = {}) =>
  recordPayment({ invoiceId, amount, paidAt: TODAY, receivedBy: "mikey", method: "Bank", note: null, payOutFrom: null, createdBy: MICHAEL, ...o });
const payoutsFor = (invoiceId: string) =>
  sql`select founder, base, bonus, total, status, created_by from payouts where invoice_id = ${invoiceId} order by number`;
async function rejection(fn: () => Promise<unknown>) {
  try {
    await fn();
    return null;
  } catch (e) {
    const message = ledgerErrorMessage(e);
    if (!message) console.error("     unexpected error:", e);
    return message;
  }
}

try {
  // 1
  await reset();
  {
    const l = await getLedger(TODAY);
    const mikeyCheck = l.cashCheck.find((c) => c.location === "mikey");
    check("1  opening Business cash TT$1,200, all with Mikey, variance 0",
      l.cash.total === 1200 && holderLine(l.cash) === "All with Mikey" && mikeyCheck?.variance === 0,
      JSON.stringify({ cash: l.cash, line: holderLine(l.cash), mikeyCheck }));
  }

  // 2
  await reset();
  {
    const inv = await invoice(2000, 0.5);
    await pay(inv, 2000);
    const p = await payoutsFor(inv);
    const c = await cash();
    check("2  TT$2,000 at 50/50, not paid out: two due payouts of 370, cash 3,200",
      p.length === 2 && p.every((r) => r.total === 370 && r.status === "due") && c.total === 3200,
      JSON.stringify({ p, c }));

    // 4 (continues from 2)
    const [first] = await sql`select id from payouts where invoice_id = ${inv} order by number limit 1`;
    await markPayoutPaidOut(String(first.id), TODAY, "mikey");
    check("4  marking the first 370 payout paid from Mikey lowers cash by 370", (await cash()).total === 2830);

    await undoPayoutPaidOut(String(first.id));
    check("   correction: undo paid out restores cash", (await cash()).total === 3200);
  }

  // 2b
  await reset();
  {
    const inv = await invoice(2000, 0.5);
    await pay(inv, 2000, { payOutFrom: "mikey" });
    const p = await payoutsFor(inv);
    const c = await cash();
    check("2b same payment, paid out now: both paid out, cash 2,460",
      p.length === 2 && p.every((r) => r.status === "paid_out") && c.total === 2460,
      JSON.stringify({ p, c }));
  }

  // 3
  await reset();
  {
    const inv = await invoice(500, 1);
    await pay(inv, 500);
    const [m, z] = await payoutsFor(inv);
    check("3  TT$500 at 100/0: Michael 117.50 (67.50 + 50), Zane 67.50 (67.50 + 0)",
      m.founder === "michael" && m.base === 67.5 && m.bonus === 50 && m.total === 117.5 &&
        z.founder === "zane" && z.base === 67.5 && z.bonus === 0 && z.total === 67.5,
      JSON.stringify({ m, z }));
  }

  // 5
  await reset();
  {
    await sql`insert into expenses (name, amount, date, paid_from) values ('Test today', 700, ${TODAY}, 'mikey')`;
    const after = (await cash()).total;
    await sql`insert into expenses (name, amount, date, paid_from) values ('Test old', 700, '2026-10-01', 'mikey')`;
    check("5  TT$700 expense from Mikey today lowers cash by 700; one before cutover changes nothing",
      after === 500 && (await cash()).total === 500);
  }

  // 6
  await reset();
  {
    const inv = await invoice(2000, 0.5);
    await pay(inv, 2000, { receivedBy: "zane" });
    const before = await cash();
    await createTransfer({ movedAt: TODAY, fromLoc: "zane", toLoc: "mikey", amount: 500, note: null, createdBy: MICHAEL });
    const after = await cash();
    check("6  TT$500 transfer Zane to Mikey: total unchanged, 500 moves between holders",
      after.total === before.total && after.mikey === before.mikey + 500 && after.zane === before.zane - 500,
      JSON.stringify({ before, after }));

    const [t] = await sql`select id from cash_movements where kind = 'transfer'`;
    await deleteTransfer(String(t.id));
    const undone = await cash();
    check("   correction: deleting the transfer restores the holder lines", undone.mikey === before.mikey && undone.zane === before.zane);
  }

  // 7
  await reset();
  {
    const inv = await invoice(2000, 0.5);
    await pay(inv, 1000);
    const [s1] = await sql`select status from invoices where id = ${inv}`;
    await pay(inv, 1000);
    const [s2] = await sql`select status, paid_date, payment_method from invoices where id = ${inv}`;
    const p = await payoutsFor(inv);
    check("7  1,000 + 1,000 on 2,000: Sent, then Paid, four payouts",
      s1.status === "Sent" && s2.status === "Paid" && s2.paid_date === TODAY && s2.payment_method === "Bank" && p.length === 4,
      JSON.stringify({ s1, s2, n: p.length }));

    // corrections on a fully paid invoice
    const lock = await rejection(() => sql`update invoices set amount = 2500 where id = ${inv}`);
    check("   correction guard: amount is locked once payments exist", !!lock && /locked/.test(lock), String(lock));

    const [last] = await sql`select id from payments where invoice_id = ${inv} order by created_at desc limit 1`;
    await deletePayment(String(last.id));
    const [s3] = await sql`select status, paid_date, payment_method from invoices where id = ${inv}`;
    const p3 = await payoutsFor(inv);
    check("   correction: deleting a payment reopens the invoice as Sent and removes its payouts",
      s3.status === "Sent" && s3.paid_date === null && s3.payment_method === null && p3.length === 2,
      JSON.stringify({ s3, n: p3.length }));
  }

  // 8
  await reset();
  {
    const inv = await invoice(2000, 0.5);
    await pay(inv, 1000);
    const over = await rejection(() => pay(inv, 1500));
    const early = await rejection(() => pay(inv, 100, { paidAt: "2026-10-21" }));
    const noShares = await invoice(800, null);
    const unshared = await rejection(() => pay(noShares, 100));
    check("8  rejected with a readable message: overpay, before cutover, no bonus shares",
      !!over && !!early && !!unshared, JSON.stringify({ over, early, unshared }));
    console.log(`     "${over}"\n     "${early}"\n     "${unshared}"`);
    const [{ n }] = await sql`select count(*)::int as n from payments`;
    check("   the rejected payments left nothing behind", n === 1);
  }

  // 9
  await reset();
  {
    const inv = await invoice(1500, null, { status: "Paid", paid_date: "2026-09-01" });
    const [s] = await sql`select status from invoices where id = ${inv}`;
    const p = await payoutsFor(inv);
    await sql`update invoices set michael_bonus_share = 0.5, zane_bonus_share = 0.5 where id = ${inv}`;
    const again = await rejection(() => pay(inv, 100));
    check("9  invoice paid before cutover stays Paid with no payouts, and cannot take a payment",
      s.status === "Paid" && p.length === 0 && !!again, String(again));
  }

  // 11
  await reset();
  {
    const [e] = await sql`
      insert into expenses (name, amount, date, paid_personally_by)
      values ('Test personal', 300, ${TODAY}, 'zane') returning id`;
    const l1 = await getLedger(TODAY);
    await reimburseExpense(String(e.id), TODAY, "mikey");
    const l2 = await getLedger(TODAY);
    check("11 TT$300 paid by Zane personally: cash unchanged, 300 owed to Zane; reimbursing from Mikey lowers cash 300 and clears it",
      l1.cash.total === 1200 && l1.owedToFounders.zane === 300 && l2.cash.total === 900 && l2.owedToFounders.zane === 0,
      JSON.stringify({ c1: l1.cash.total, o1: l1.owedToFounders, c2: l2.cash.total, o2: l2.owedToFounders }));

    await undoReimburseExpense(String(e.id));
    const l3 = await getLedger(TODAY);
    check("   correction: undo reimbursement", l3.cash.total === 1200 && l3.owedToFounders.zane === 300);
  }

  // 12
  await reset();
  {
    const inv = await invoice(1000, 0.5);
    await pay(inv, 1000, { createdBy: ZANE });
    await createTransfer({ movedAt: TODAY, fromLoc: "mikey", toLoc: "vantage", amount: 100, note: null, createdBy: MICHAEL });
    await createCashCount({ countedAt: TODAY, location: "vantage", amount: 100, note: null, createdBy: MICHAEL });
    const [pm] = await sql`select created_by from payments`;
    const po = await payoutsFor(inv);
    const [mv] = await sql`select created_by from cash_movements where kind = 'transfer'`;
    const [ct] = await sql`select created_by from cash_counts where location = 'vantage'`;
    check("12 every row records who entered it",
      pm.created_by === ZANE && po.every((r) => r.created_by === ZANE) && mv.created_by === MICHAEL && ct.created_by === MICHAEL);

    const vantage = (await getLedger(TODAY)).cashCheck.find((c) => c.location === "vantage");
    await createCashCount({ countedAt: TODAY, location: "vantage", amount: 90, note: null, createdBy: MICHAEL });
    const short = (await getLedger(TODAY)).cashCheck.find((c) => c.location === "vantage");
    await deleteLatestCashCount("vantage");
    const restored = (await getLedger(TODAY)).cashCheck.find((c) => c.location === "vantage");
    check("   cash check: matches at 0, shows 10 short, deleting the count restores the earlier one",
      vantage?.variance === 0 && short?.variance === -10 && restored?.variance === 0);
  }

  // Cash check is as at the count, including same-day entries.
  await reset();
  {
    const inv = await invoice(2000, 0.5);
    await pay(inv, 2000); // same day as the cutover count, entered after it
    const same = (await getLedger(TODAY)).cashCheck.find((c) => c.location === "mikey");
    const inv2 = await invoice(1000, 0.5);
    await pay(inv2, 1000, { paidAt: "2026-10-23" });
    const later = (await getLedger("2026-10-23")).cashCheck.find((c) => c.location === "mikey");
    await createCashCount({ countedAt: "2026-10-23", location: "mikey", amount: 4200, note: null, createdBy: MICHAEL });
    const counted = (await getLedger("2026-10-23")).cashCheck.find((c) => c.location === "mikey");
    check("   cash check: a payment entered after the count (same day or later) is not a shortfall",
      same?.variance === 0 && same?.expectedNow === 3200 && later?.variance === 0 && later?.expectedNow === 4200 &&
        counted?.expected === 4200 && counted?.variance === 0,
      JSON.stringify({ same, later, counted }));
  }

  // Owed to us, founder pay by payment month, this month net.
  await reset();
  {
    const inv = await invoice(2000, 0.5);
    await invoice(300, 0.5, { status: "Draft" });
    await invoice(400, 0.5, { status: "Void" });
    await pay(inv, 500);
    const o1 = (await getLedger(TODAY)).owedToUs;
    await pay(inv, 1500);
    const o2 = (await getLedger(TODAY)).owedToUs;
    check("   owed to us: partial payment reduces it, Draft and Void excluded, full payment clears it",
      o1.total === 1500 && o1.count === 1 && o2.total === 0 && o2.count === 0, JSON.stringify({ o1, o2 }));

    const [m] = await sql`select id from payouts where founder = 'michael' order by number limit 1`;
    await markPayoutPaidOut(String(m.id), "2026-11-05", "mikey");
    const fp = (await getLedger("2026-11-05")).founderPay;
    const mich = fp.find((r) => r.founder === "michael");
    check("   founder pay groups by the client payment month, not the payout month",
      fp.every((r) => r.month === "2026-10") && mich?.paidOut === 92.5 && mich?.due === 277.5,
      JSON.stringify(fp));

    await sql`insert into expenses (name, amount, date, paid_from) values ('Old', 99, '2026-10-01', 'mikey')`;
    await sql`insert into expenses (name, amount, date, paid_from) values ('Now', 100, ${TODAY}, 'mikey')`;
    const inv3 = await invoice(500, 0.5);
    await pay(inv3, 500, { paidAt: "2026-10-30" }); // future-dated
    const month = (await getLedger(TODAY)).month;
    check("   this month net: from cutover to today only", month.payments === 2000 && month.expenses === 100 &&
      month.payoutsPaidOut === 0 && month.net === 1900, JSON.stringify(month));
  }

  // A new split rule applies from its effective date only.
  await reset();
  {
    await sql`insert into split_rules values (2, '2026-11-01', 0.20, 0.10, 0.10)`;
    try {
      const a = await invoice(1000, 0.5);
      const b = await invoice(1000, 0.5);
      await pay(a, 1000, { paidAt: "2026-10-31" });
      await pay(b, 1000, { paidAt: "2026-11-01" });
      const pa = await sql`select total, rule_version from payouts where invoice_id = ${a}`;
      const pb = await sql`select total, rule_version from payouts where invoice_id = ${b}`;
      check("   split rule v2 applies from its effective date; earlier payments keep v1",
        pa.every((r) => r.total === 185 && r.rule_version === 1) && pb.every((r) => r.total === 180 && r.rule_version === 2),
        JSON.stringify({ pa, pb }));
    } finally {
      await sql`delete from payments`;
      await sql`delete from split_rules where version = 2`;
    }
  }

  // Invoice guards.
  await reset();
  {
    const inv = await invoice(1000, 0.5);
    const direct = await rejection(() => sql`update invoices set status = 'Paid' where id = ${inv}`);
    await pay(inv, 400);
    const voided = await rejection(() => sql`update invoices set status = 'Void' where id = ${inv}`);
    const drafted = await rejection(() => sql`update invoices set status = 'Draft' where id = ${inv}`);
    const noPay = await invoice(500, 0.5);
    const voidOk = await rejection(() => sql`update invoices set status = 'Void' where id = ${noPay}`);
    const voidPay = await rejection(() => pay(noPay, 100));
    check("   guards: no direct Paid; no Draft or Void once paid into; a Void invoice takes no payment",
      !!direct && !!voided && !!drafted && voidOk === null && !!voidPay,
      JSON.stringify({ direct, voided, drafted, voidOk, voidPay }));
  }

  // Projected founder earnings from unpaid invoices (migration 012).
  await reset();
  {
    const a = await invoice(2000, 0.5); // shares set
    await invoice(1000, null, { due_date: "2026-09-30" }); // overdue, no shares: base only
    await invoice(500, 0.5, { status: "Draft" }); // not owed: excluded
    await invoice(700, 0.5, { status: "Paid", paid_date: "2026-09-01" }); // excluded
    const p1 = (await getLedger(TODAY)).projection;
    check("   projection: 2,000 at 50/50 + 1,000 overdue without shares; Draft and Paid excluded",
      p1.michael.total === 370 + 135 && p1.zane.total === 370 + 135 && p1.unassignedBonus === 100 &&
        p1.invoicesWithoutShares === 1 && p1.invoices.length === 2 && p1.invoices.some((i) => i.overdue && i.unassignedBonus === 100),
      JSON.stringify(p1));

    await pay(a, 1000);
    const p2 = (await getLedger(TODAY)).projection;
    check("   projection: a partial payment moves its share out of projected (now due)",
      p2.michael.total === 185 + 135 && p2.zane.total === 185 + 135, JSON.stringify({ m: p2.michael, z: p2.zane }));

    await pay(a, 1000);
    const p3 = (await getLedger(TODAY)).projection;
    check("   projection: a fully paid invoice drops out", p3.invoices.length === 1 && p3.michael.total === 135,
      JSON.stringify(p3.invoices));
  }

  // Preview agrees with the trigger to the cent.
  await reset();
  {
    const rule = (await getLedger(TODAY)).rule;
    const amounts = [0.01, 0.05, 1, 3.33, 99.99, 333.33, 1234.56, 2000, 7777.77];
    const shares = [0, 0.25, 0.3333, 0.5, 0.6667, 1];
    let mismatches = 0;
    for (const a of amounts) {
      for (const s of shares) {
        const inv = await invoice(a, s);
        await pay(inv, a);
        const rows = await payoutsFor(inv);
        const m = rows.find((r) => r.founder === "michael")?.total ?? 0;
        const z = rows.find((r) => r.founder === "zane")?.total ?? 0;
        const p = splitPreview(a, rule, s);
        if (m !== p.michaelTotal || z !== p.zaneTotal) {
          mismatches++;
          console.log(`     mismatch a=${a} s=${s}: db ${m}/${z} preview ${p.michaelTotal}/${p.zaneTotal}`);
        }
      }
    }
    check("   preview matches trigger to the cent (54 amount and share pairs)", mismatches === 0);
  }

  await reset();
} finally {
  await sql.end();
  await closeDb();
}

console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
