// Founder ledger helpers shared by server and client. Pure, no DB.
//
// splitPreview() is for DISPLAY ONLY. The saved figures always come from the
// on_payment_insert() trigger (migration 011); this mirrors its rounding so the
// preview and the saved payouts agree to the cent.

// mikey/zane = money in a founder's hand not sorted yet; business = the safe.
export const HOLDERS = ["mikey", "zane", "business"] as const;
export type Holder = (typeof HOLDERS)[number];
export const HOLDER_LABEL: Record<Holder, string> = { mikey: "Mikey", zane: "Zane", business: "Business cash" };

export const FOUNDERS = ["michael", "zane"] as const;
export type Founder = (typeof FOUNDERS)[number];
export const FOUNDER_LABEL: Record<Founder, string> = { michael: "Michael", zane: "Zane" };

export const PAYMENT_METHODS = ["Bank", "PayPal", "Stripe", "Cash", "Other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type SplitRule = {
  version: number;
  effectiveFrom: string;
  bonusPoolPct: number;
  michaelBasePct: number;
  zaneBasePct: number;
};

// The expense form's single "Paid with" select, mapped onto the two columns
// (expenses.paid_from / paid_personally_by). Exactly one is set.
export const PAID_WITH = [
  { value: "cash:mikey", label: "Business cash held by Mikey" },
  { value: "cash:zane", label: "Business cash held by Zane" },
  { value: "cash:business", label: "Business cash (safe)" },
  { value: "own:michael", label: "Michael's own money" },
  { value: "own:zane", label: "Zane's own money" },
] as const;
export type PaidWith = (typeof PAID_WITH)[number]["value"];

/** "" clears the column (db.ts toColumns), so switching source never leaves both set. */
export function paidWithFields(v: string): { "Paid From": Holder | ""; "Paid Personally By": Founder | "" } {
  const [kind, who] = v.split(":");
  if (kind === "cash") return { "Paid From": who as Holder, "Paid Personally By": "" };
  if (kind === "own") return { "Paid From": "", "Paid Personally By": who as Founder };
  return { "Paid From": "", "Paid Personally By": "" };
}

export function paidWithValue(e: { "Paid From"?: string; "Paid Personally By"?: string }): PaidWith | "" {
  if (e["Paid From"]) return `cash:${e["Paid From"]}` as PaidWith;
  if (e["Paid Personally By"]) return `own:${e["Paid Personally By"]}` as PaidWith;
  return "";
}

/** Same rounding as the trigger (half away from zero for positive amounts). */
export const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

export function splitPreview(amount: number, rule: SplitRule, michaelBonusShare: number) {
  const pool = round2(amount * rule.bonusPoolPct);
  const allocation = round2(amount - pool);
  const michaelBase = round2(allocation * rule.michaelBasePct);
  const zaneBase = round2(allocation * rule.zaneBasePct);
  const michaelBonus = round2(pool * michaelBonusShare);
  const zaneBonus = round2(pool - michaelBonus);
  return {
    pool,
    allocation,
    michaelBase,
    zaneBase,
    michaelBonus,
    zaneBonus,
    michaelTotal: round2(michaelBase + michaelBonus),
    zaneTotal: round2(zaneBase + zaneBonus),
    kept: round2(amount - michaelBase - michaelBonus - zaneBase - zaneBonus),
  };
}

export function tt(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}TT$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "All with Mikey", or "Mikey TT$X, Zane TT$Y" for every holder not at zero. */
export function holderLine(byHolder: Record<Holder, number>): string {
  const held = HOLDERS.filter((h) => byHolder[h] !== 0);
  if (held.length === 0) return "Nothing held";
  if (held.length === 1 && byHolder[held[0]] > 0)
    return held[0] === "business" ? "All in business cash" : `All with ${HOLDER_LABEL[held[0]]}`;
  return held.map((h) => `${HOLDER_LABEL[h]} ${tt(byHolder[h])}`).join(", ");
}

/** Form check on percentage strings. Null when both are empty or both set and totalling 100. */
export function shareError(michael: string, zane: string): string | null {
  if (michael === "" && zane === "") return null;
  if (michael === "" || zane === "") return "Set both bonus shares.";
  if (Math.round((parseFloat(michael) + parseFloat(zane)) * 100) !== 10000) return "Bonus shares must total 100%.";
  return null;
}

/** "Michael TT$X, Zane TT$Y" for every founder owed more than zero, or "" when none. */
export function owedLine(owed: Record<Founder, number>): string {
  return FOUNDERS.filter((f) => owed[f] > 0)
    .map((f) => `${FOUNDER_LABEL[f]} ${tt(owed[f])}`)
    .join(", ");
}
