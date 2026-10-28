// Who a project belongs to, as one form value. Pure, shared by every project
// form. A project belongs to a client, to a lead (before there is a client),
// is internal (Mindelo's own), or is unassigned. Client wins when a converted
// lead's project has both: lead_id is kept on it as history only.

export type OwnerValue = "" | "internal" | `client:${string}` | `lead:${string}`;

export function ownerFields(v: string): { Client: string[]; Lead: string[]; Internal: boolean } {
  if (v === "internal") return { Client: [], Lead: [], Internal: true };
  const [kind, id] = v.split(":");
  if (kind === "client" && id) return { Client: [id], Lead: [], Internal: false };
  if (kind === "lead" && id) return { Client: [], Lead: [id], Internal: false };
  return { Client: [], Lead: [], Internal: false };
}

export function ownerValue(p: { Client?: string[]; Lead?: string[]; Internal?: boolean }): OwnerValue {
  if (p.Client?.[0]) return `client:${p.Client[0]}`;
  if (p.Lead?.[0]) return `lead:${p.Lead[0]}`;
  if (p.Internal) return "internal";
  return "";
}
