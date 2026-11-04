import type { Activity } from "@/lib/documents-db";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-TT", { timeZone: "America/Port_of_Spain", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const who = (email: string) => email.split("@")[0];

/** What changed on these records, newest first, with who did it and whether through Claude. */
export function ActivityList({ items, empty = "Nothing recorded yet." }: { items: Activity[]; empty?: string }) {
  return (
    <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold text-[#1B2533]">Activity</h2>
      <p className="mt-0.5 text-xs text-[#4A5568]">Every change to deals, documents and files, who made it, and whether it came through Claude.</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B7789]">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#EEF1F5] text-sm">
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
              <span className="text-[#1B2533]">{a.summary}</span>
              <span className="text-xs text-[#5A6678]">
                {who(a.actor)}{a.via === "claude" ? " via Claude" : ""} · {when(a.created)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
