import { redirect } from "next/navigation";

/**
 * Finance is a group of subpages. Old bookmarks and emails that point here
 * with ?status= or ?client= were invoice filters, so they land on Invoices
 * with the same parameters. A bare /admin/finance lands on Money received.
 * ponytail: piece 4 replaces this with the Finance Summary page.
 */
export default async function FinanceIndex({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const one of [value].flat()) if (one !== undefined) params.append(key, one);
  }
  redirect(params.size ? `/admin/finance/invoices?${params}` : "/admin/finance/received");
}
