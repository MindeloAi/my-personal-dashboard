"use client";

import { useState } from "react";
import Link from "next/link";
import { ClientModal, PANEL, STATUS_BADGE } from "@/components/dashboard/clients-list";
import { DateLine } from "@/components/dashboard/timeline/date-line";
import { EntryModal } from "@/components/dashboard/timeline/entry-modal";
import { HistoryList } from "@/components/dashboard/timeline/history-list";
import { OwesList } from "@/components/dashboard/timeline/owes-list";
import type { Client, Project } from "@/lib/db";
import type { ClientPromise, Lit, TimelineEntry, UnpaidInvoice } from "@/lib/timeline";

type Props = {
  client: Client;
  projects: Project[];
  entries: TimelineEntry[];
  promises: ClientPromise[];
  invoices: UnpaidInvoice[];
  today: string;
};

export function TimelineView({ client, projects, entries, promises, invoices, today }: Props) {
  const [lit, setLit] = useState<Lit | null>(null);
  // A new object per dot click tells the history to scroll; row and diamond clicks leave it null.
  const [scrollTo, setScrollTo] = useState<{ ids: string[] } | null>(null);
  const light = (l: Lit, opts?: { scroll?: boolean }) => {
    setLit(l);
    setScrollTo(opts?.scroll ? { ids: l.entries } : null);
  };
  const clear = () => {
    setLit(null);
    setScrollTo(null);
  };
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const status = client.Status ?? "Active";
  const name = client.Company || client.Name;

  return (
    <div className="space-y-3">
      <header className={`${PANEL} p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`}>
        <div className="min-w-0">
          <Link href="/admin/clients" className="text-xs text-zinc-500 hover:text-zinc-300">
            Clients
          </Link>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <h1 className="text-xl font-semibold text-white leading-tight">{name}</h1>
            <span className={`text-xs px-2 py-1 rounded-full border font-medium ${STATUS_BADGE[status]}`}>
              {status}
            </span>
          </div>
          {client.Company && client.Name !== client.Company && (
            <p className="text-sm text-zinc-400">{client.Name}</p>
          )}
          {projects.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {projects.map((p) => (
                <li key={p.id} className="text-xs px-2 py-1 rounded-full border border-[#2a2e34] text-zinc-300">
                  {p.Name}
                  {p.Status ? <span className="text-zinc-500"> · {p.Status}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-11 sm:min-h-0 text-xs px-3 py-2 rounded-lg font-semibold bg-[#bfff3a] text-black hover:bg-[#bfff3a]/80 transition-colors"
          >
            + Add call, email or message
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 sm:min-h-0 text-xs px-3 py-2 rounded-lg font-semibold border border-[#2a2e34] text-zinc-200 hover:bg-white/5 transition-colors"
          >
            Edit
          </button>
        </div>
      </header>

      <DateLine entries={entries} promises={promises} invoices={invoices} today={today} lit={lit} onLight={light} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start" data-region="lists">
        {(["client", "us"] as const).map((side) => (
          <OwesList
            key={side}
            side={side}
            title={side === "client" ? `${name} owes us` : `We owe ${name}`}
            promises={promises}
            invoices={invoices}
            today={today}
            lit={lit}
            onLight={light}
            onClear={clear}
            clientId={client.id}
          />
        ))}
      </div>

      <HistoryList entries={entries} promises={promises} lit={lit} onLight={light} onClear={clear} clientId={client.id} today={today} scrollTo={scrollTo} />

      {adding && <EntryModal clientId={client.id} today={today} promises={promises} onClose={() => setAdding(false)} />}
      {editing && <ClientModal client={client} onClose={() => setEditing(false)} />}
    </div>
  );
}
