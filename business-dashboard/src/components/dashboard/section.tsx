import { cn } from "@/lib/utils";

type SectionProps = {
  /** Anchor id, useful for in-page scrolling / deep links. */
  id?: string;
  /** Section heading. */
  title?: string;
  /** Optional sub-heading under the title. */
  description?: string;
  /** Optional action node rendered on the right of the header (filters, buttons). */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/**
 * Consistent panel/section shell so every dashboard module drops in uniformly.
 * Presentational only (no client state) — safe to use from server or client trees.
 */
export function Section({
  id,
  title,
  description,
  action,
  className,
  children,
}: SectionProps) {
  return (
    <section id={id} className={cn("space-y-3 dashboard-fade-in", className)}>
      {(title || description || action) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            {title && (
              <h2 className="text-lg font-semibold tracking-tight text-[#f5f5f5]">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-zinc-500">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
