import type { VaultActivity } from "@/lib/vault";

// Recent-activity timeline built from the vault's daily notes: `[[Project]]` touches
// and `**Decision:**` lines, newest first. Presentational (server-safe) — the sync
// script has already ordered and shaped the data.

function formatDate(date: string): string {
  // Dates arrive as YYYY-MM-DD from the sync script. Render as "Jun 18" without
  // constructing a Date (avoids any timezone drift).
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthName = months[Number(m) - 1] ?? m;
  return `${monthName} ${Number(d)}`;
}

export function VaultActivity({ activity }: { activity: VaultActivity[] }) {
  if (activity.length === 0) {
    return (
      <div className="rounded-[20px] border border-[#2a2e34] bg-[#14181d] p-6">
        <p className="text-sm text-zinc-600">No recent activity logged in daily notes.</p>
      </div>
    );
  }

  // Group consecutive entries by date so each day gets one header.
  const groups: { date: string; items: VaultActivity[] }[] = [];
  for (const item of activity) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }

  return (
    <div className="rounded-[20px] border border-[#2a2e34] bg-[#14181d] p-6">
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.date}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {formatDate(group.date)}
            </p>
            <ul className="space-y-2 border-l border-[#2a2e34] pl-4">
              {group.items.map((item, i) => (
                <li key={`${group.date}-${i}`} className="relative">
                  <span
                    className={`absolute -left-[21px] top-1.5 h-1.5 w-1.5 rounded-full ${
                      item.kind === "decision" ? "bg-[#c44dff]" : "bg-[#3affd1]"
                    }`}
                  />
                  <div className="text-xs leading-relaxed">
                    {item.project && (
                      <span className="font-medium text-zinc-200">{item.project}</span>
                    )}
                    {item.kind === "decision" && (
                      <span className="ml-1.5 rounded bg-[#c44dff]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#c44dff]">
                        decision
                      </span>
                    )}
                    {item.note && (
                      <span className="ml-1 text-zinc-500">
                        {item.project ? "— " : ""}
                        {item.note}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
