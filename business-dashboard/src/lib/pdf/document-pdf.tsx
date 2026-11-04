// The A4 layout for every document type. Pure: it takes PdfData and returns
// PDF bytes, so it is tested without a database (scripts/pdf.test.tsx).
// Loading the data and storing the file is lib/pdf/store.ts.
//
// Brand: dark-ink logo on white, IBM Plex Sans, Corporate Navy. No em dashes.
import { readFileSync } from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { CarePlan, DocType, ScheduleLine, Section } from "../documents";
import { DOC_TYPE_LABEL } from "../documents";
import { formatMoney, parseItems } from "../doc-templates";

export type PdfData = {
  type: DocType;
  title: string;
  reference: string | null;
  /** 0 renders a draft preview. */
  version: number;
  date: string;
  client: { name: string; company: string | null; email: string | null; phone: string | null } | null;
  projectName: string | null;
  sections: Section[];
  deal: { priceTotal: number | null; currency: string; paymentSchedule: ScheduleLine[]; carePlan: CarePlan | null } | null;
  invoice: { number: string | null; issueDate: string | null; dueDate: string | null; amount: number | null } | null;
  bank: { accountName: string; bankName: string; branch: string | null; accountNumber: string; accountType: string | null } | null;
  /** Receipts only: the one payment it is for, and where the invoice stood once it was paid. */
  receipt: {
    number: string | null;
    paidAt: string;
    method: string | null;
    amount: number;
    invoiceNumber: string | null;
    invoiceTotal: number;
    paidToDate: number;
  } | null;
};

// Next traces these into the function bundle via next.config's outputFileTracingIncludes (Task 6).
const ASSETS = path.join(process.cwd(), "src/assets/pdf");
Font.register({
  family: "Plex",
  fonts: [
    { src: path.join(ASSETS, "IBMPlexSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(ASSETS, "IBMPlexSans-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(ASSETS, "IBMPlexSans-Bold.ttf"), fontWeight: 700 },
  ],
});
// Words are never hyphenated, but a long unbroken one (a URL) is cut into
// pieces so it wraps instead of running into the amount column.
Font.registerHyphenationCallback((word) => (word.length > 35 ? word.match(/.{1,30}/g) ?? [word] : [word]));
// Passed as bytes: react-pdf reads a Windows path like C:\... as a URL and tries to fetch it.
// Read on first render, so a missing asset cannot break loading every module that imports this one.
let logo: { data: Buffer; format: "png" } | null = null;
const getLogo = () => (logo ??= { data: readFileSync(path.join(ASSETS, "mindelo-logo-ink.png")), format: "png" });

const ADDRESS = "4 Warren Street, Port of Spain";
const NAVY = "#0E1A2B";
const MUTED = "#5A6678";
const RULE = "#DCE1E8";
const GREEN = "#05C29A";
const ORANGE = "#B23A0A";
// Line height in points, set per block. A unitless lineHeight is multiplied by the
// element's own fontSize (18 when it has none), and any lineHeight on the Page
// pushes the absolute footer off the sheet.
const LH = "15pt";

const s = StyleSheet.create({
  page: { fontFamily: "Plex", fontSize: 10, color: NAVY, paddingTop: 40, paddingBottom: 60, paddingHorizontal: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 120 },
  meta: { alignItems: "flex-end", lineHeight: LH },
  kind: { fontSize: 9, fontWeight: 600, letterSpacing: 1.5, color: MUTED },
  rule: { height: 2, backgroundColor: GREEN, marginTop: 14, marginBottom: 18, width: 40 },
  parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18, lineHeight: LH },
  label: { fontSize: 8, fontWeight: 600, color: MUTED, letterSpacing: 1, marginBottom: 2 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 14 },
  h: { fontSize: 11, fontWeight: 600, marginTop: 12, marginBottom: 4 },
  p: { marginBottom: 6, lineHeight: LH },
  li: { flex: 1, lineHeight: LH },
  bullet: { flexDirection: "row", marginBottom: 2 },
  dot: { width: 10 },
  table: { borderTopWidth: 1, borderColor: RULE, marginTop: 6 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: RULE, paddingVertical: 5 },
  cellGrow: { flex: 1, paddingRight: 8, lineHeight: LH },
  cellMid: { width: 130, color: MUTED },
  cellAmt: { width: 90, textAlign: "right" },
  total: { flexDirection: "row", paddingVertical: 6 },
  bold: { fontWeight: 700 },
  bank: { marginTop: 14, padding: 10, borderWidth: 1, borderColor: RULE, borderRadius: 4, lineHeight: LH },
  draft: { color: ORANGE, fontWeight: 600 },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED },
});

function Body({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((para, i) => {
        const lines = para.split("\n");
        if (lines.every((l) => l.trim().startsWith("- ")))
          return lines.map((l, j) => (
            <View key={`${i}-${j}`} style={s.bullet}>
              <Text style={s.dot}>•</Text>
              <Text style={s.li}>{l.trim().slice(2)}</Text>
            </View>
          ));
        return <Text key={i} style={s.p}>{para.trim()}</Text>;
      })}
    </>
  );
}

function Money({ rows, total, currency }: { rows: { a: string; b?: string; amount: number }[]; total: number | null; currency: string }) {
  return (
    <View style={s.table}>
      {rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          <Text style={s.cellGrow}>{r.a}</Text>
          {r.b !== undefined && <Text style={s.cellMid}>{r.b}</Text>}
          <Text style={s.cellAmt}>{formatMoney(r.amount, currency)}</Text>
        </View>
      ))}
      {total != null && (
        <View style={s.total}>
          <Text style={[s.cellGrow, s.bold]}>Total</Text>
          <Text style={[s.cellAmt, s.bold]}>{formatMoney(total, currency)}</Text>
        </View>
      )}
    </View>
  );
}

function carePlanLine(c: CarePlan, currency: string): string {
  return `Care plan: ${formatMoney(c.monthlyAmount, currency)} a month, for a minimum of ${c.minimumMonths} months, then month to month until either side gives ${c.noticeDays} days' notice.`;
}

function Receipt({ r, currency }: { r: NonNullable<PdfData["receipt"]>; currency: string }) {
  const balance = Math.round((r.invoiceTotal - r.paidToDate) * 100) / 100;
  const line = (label: string, value: string, bold = false) => (
    <View style={s.total}>
      <Text style={[s.cellGrow, bold ? s.bold : { color: MUTED }]}>{label}</Text>
      <Text style={[s.cellAmt, bold ? s.bold : {}]}>{value}</Text>
    </View>
  );
  return (
    <View wrap={false}>
      <View style={s.table}>
        <View style={s.row}>
          <Text style={s.cellGrow}>Payment towards {r.invoiceNumber ?? "your invoice"}</Text>
          <Text style={[s.cellAmt, s.bold]}>{formatMoney(r.amount, currency)}</Text>
        </View>
      </View>
      <Text style={[s.p, { color: MUTED, marginTop: 6 }]}>Paid on {r.paidAt}{r.method ? ` by ${r.method}` : ""}</Text>
      <View style={{ marginTop: 6, borderTopWidth: 1, borderColor: RULE }}>
        {line("Invoice total", formatMoney(r.invoiceTotal, currency))}
        {line("Paid to date", formatMoney(r.paidToDate, currency))}
        {line("Balance", balance <= 0 ? "Paid in full" : formatMoney(balance, currency), true)}
      </View>
    </View>
  );
}

function Pdf({ d }: { d: PdfData }) {
  const currency = d.deal?.currency ?? "TTD";
  const items = d.sections.find((x) => x.key === "items");
  const prose = d.sections.filter((x) => x.key !== "items" && x.body.trim());
  const parsed = items ? parseItems(items.body).items : [];
  // A quote with its own items and a deal with no schedule would print the same money twice.
  const showDeal = parsed.length === 0 || (d.deal?.paymentSchedule.length ?? 0) > 0;
  return (
    <Document title={d.title} author="Mindelo" creator="Mindelo">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
          <Image style={s.logo} src={getLogo()} />
          <View style={s.meta}>
            <Text style={s.kind}>{DOC_TYPE_LABEL[d.type].toUpperCase()}</Text>
            {d.type === "receipt" ? d.receipt?.number && <Text>{d.receipt.number}</Text> : d.invoice?.number && <Text>{d.invoice.number}</Text>}
            {d.reference && <Text>{d.reference}</Text>}
            <Text>{d.date}</Text>
            {d.version === 0 ? <Text style={s.draft}>DRAFT, not for sending</Text> : <Text style={{ color: MUTED }}>Version {d.version}</Text>}
          </View>
        </View>
        <View style={s.rule} />

        <View style={s.parties}>
          <View>
            <Text style={s.label}>{d.type === "invoice" ? "BILL TO" : d.type === "receipt" ? "RECEIVED FROM" : "PREPARED FOR"}</Text>
            {d.client?.company && <Text style={s.bold}>{d.client.company}</Text>}
            {d.client && <Text>{d.client.name}</Text>}
            {d.client?.email && <Text>{d.client.email}</Text>}
            {d.client?.phone && <Text>{d.client.phone}</Text>}
            {d.projectName && <Text style={{ color: MUTED }}>{d.projectName}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.label}>FROM</Text>
            <Text style={s.bold}>Mindelo</Text>
            <Text>MINDELOAI LIMITED</Text>
            <Text>{ADDRESS}</Text>
            {d.type === "invoice" && d.invoice?.issueDate && <Text>Issued {d.invoice.issueDate}</Text>}
            {d.type === "invoice" && d.invoice?.dueDate && <Text style={s.bold}>Due {d.invoice.dueDate}</Text>}
          </View>
        </View>

        <Text style={s.title}>{d.title}</Text>

        {d.type === "receipt" && d.receipt && <Receipt r={d.receipt} currency={currency} />}

        {items && parsed.length > 0 && (
          <>
            <Text style={s.h}>{items.heading}</Text>
            <Money
              rows={parsed.map((i) => ({ a: i.description, amount: i.amount }))}
              total={d.invoice?.amount ?? parsed.reduce((t, i) => t + i.amount, 0)}
              currency={currency}
            />
          </>
        )}

        {prose.map((sec) => (
          <View key={sec.key}>
            <Text style={s.h}>{sec.heading}</Text>
            <Body text={sec.body} />
          </View>
        ))}

        {(d.type === "proposal" || d.type === "quote") && d.deal?.priceTotal != null && (
          <View>
            {showDeal && (
              <>
                <Text style={s.h} minPresenceAhead={80}>{parsed.length > 0 ? "Payment schedule" : "Investment"}</Text>
                <Money
                  rows={d.deal.paymentSchedule.length
                    ? d.deal.paymentSchedule.map((l) => ({ a: l.label, b: l.trigger, amount: l.amount }))
                    : [{ a: "Total", amount: d.deal.priceTotal }]}
                  total={d.deal.paymentSchedule.length ? d.deal.priceTotal : null}
                  currency={currency}
                />
              </>
            )}
            {d.deal.carePlan && <Text style={[s.p, { marginTop: 8 }]}>{carePlanLine(d.deal.carePlan, currency)}</Text>}
          </View>
        )}

        {d.type === "invoice" && d.bank && (
          <View style={s.bank} wrap={false}>
            <Text style={s.label}>PAYMENT DETAILS</Text>
            <Text>Account name: {d.bank.accountName}</Text>
            <Text>Bank: {d.bank.bankName}{d.bank.branch ? `, ${d.bank.branch}` : ""}</Text>
            <Text>Account number: {d.bank.accountNumber}</Text>
            {d.bank.accountType && <Text>Account type: {d.bank.accountType}</Text>}
            {d.invoice?.number && <Text style={{ color: MUTED }}>Please use {d.invoice.number} as the payment reference.</Text>}
          </View>
        )}

        {d.type === "receipt" && <Text style={[s.p, s.bold, { marginTop: 14 }]}>Received with thanks.</Text>}

        <View style={s.footer} fixed>
          <Text>Mindelo is a trading name of MINDELOAI LIMITED</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderDocumentPdf(d: PdfData): Promise<Buffer> {
  return renderToBuffer(<Pdf d={d} />);
}
