"use client";

import type { Client, Lead } from "@/lib/airtable";

/** "Belongs to": a client, a lead (before there is a client), or internal.
 *  Named "belongsTo" because both project forms already use "owner" for M/Partner/Both. */
export function OwnerSelect({
  clients,
  leads,
  defaultValue,
  className,
}: {
  clients: Client[];
  leads: Lead[];
  defaultValue: string;
  className: string;
}) {
  const openLeads = leads.filter((l) => l.Status !== "Lost" || defaultValue === `lead:${l.id}`);
  return (
    <select name="belongsTo" defaultValue={defaultValue} className={className}>
      <option value="">— Not assigned</option>
      <option value="internal">Internal (Mindelo&apos;s own)</option>
      <optgroup label="Clients">
        {clients.map((c) => (
          <option key={c.id} value={`client:${c.id}`}>{c.Company || c.Name}</option>
        ))}
      </optgroup>
      <optgroup label="Leads (not a client yet)">
        {openLeads.map((l) => (
          <option key={l.id} value={`lead:${l.id}`}>{l["Business Name"] || l.Name}</option>
        ))}
      </optgroup>
    </select>
  );
}
