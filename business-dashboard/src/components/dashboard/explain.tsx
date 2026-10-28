/**
 * Purpose text, in one format everywhere. Plain visible text, never tooltips,
 * so a founder, an accountant and an AI agent reading the page all get the
 * same words. Server-safe (no client state).
 */

/** Page title plus one sentence on what the page is for. */
export function PageHeader({ title, purpose, action }: { title: string; purpose: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-[#1B2533]">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-[#4A5568]">{purpose}</p>
      </div>
      {action && <div className="shrink-0 print:hidden">{action}</div>}
    </div>
  );
}

/** What a section, table or chart shows, how to read it, and what to watch for. */
export function Explain({ shows, read, watch, className }: { shows: string; read?: string; watch?: string; className?: string }) {
  const lines = [
    ["What it shows", shows],
    ["How to read it", read],
    ["What to watch for", watch],
  ].filter((l): l is [string, string] => !!l[1]);
  return (
    <div className={`max-w-3xl space-y-0.5 text-xs leading-relaxed text-[#4A5568] ${className ?? ""}`}>
      {lines.map(([label, text]) => (
        <p key={label}>
          <span className="font-semibold text-[#334155]">{label}:</span> {text}
        </p>
      ))}
    </div>
  );
}

/** A headline number: what it counts, the figure, and where it comes from. */
export function StatTile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="border border-[#DCE1E8] bg-white p-4 break-inside-avoid">
      <p className="text-xs font-medium text-[#4A5568]">{label}</p>
      <p className={`mt-1 text-xl font-semibold sm:text-2xl ${tone ?? "text-[#1B2533]"}`}>{value}</p>
      <p className="mt-1 text-xs leading-snug text-[#5A6678]">{note}</p>
    </div>
  );
}
