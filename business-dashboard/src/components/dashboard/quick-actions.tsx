"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  createInvoiceAction,
  createExpenseAction,
  createProjectAction,
} from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";
import type { Client, Project } from "@/lib/airtable";

type ModalKind = "invoice" | "expense" | "project" | null;

type Props = {
  clients?: Client[];
  projects?: Project[];
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";

function SubmitRow({
  pending,
  onClose,
  accent,
}: {
  pending: boolean;
  onClose: () => void;
  accent: string;
}) {
  return (
    <div className="flex gap-2 justify-end mt-6">
      <button
        type="button"
        onClick={onClose}
        className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending}
        className="text-xs px-4 py-2 rounded-xl font-semibold disabled:opacity-40 transition-colors"
        style={{ background: accent, color: "#000" }}
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function InvoiceModal({
  projects,
  onClose,
}: {
  projects: Project[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const today = format(new Date(), "yyyy-MM-dd");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = fd.get("amount") as string;
    const projectId = (fd.get("projectId") as string) || "";
    const invoiceType = (fd.get("invoiceType") as string) || "";
    const status = (fd.get("status") as string) || "Draft";
    start(async () => {
      try {
        await createInvoiceAction({
          "Invoice Number": (fd.get("invoiceNumber") as string) || undefined,
          Amount: amount ? parseFloat(amount) : undefined,
          "Invoice Type": invoiceType ? (invoiceType as InvoiceTypeValue) : undefined,
          Status: status as InvoiceStatusValue,
          "Issue Date": (fd.get("issueDate") as string) || undefined,
          "Due Date": (fd.get("dueDate") as string) || undefined,
          Notes: (fd.get("notes") as string) || undefined,
          Project: projectId ? [projectId] : undefined,
        });
        toast.success("Invoice created");
        onClose();
      } catch {
        toast.error("Failed to create invoice");
      }
    });
  }

  return (
    <ModalShell title="New Invoice" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Project">
          <select name="projectId" className={selectCls} defaultValue="">
            <option value="">— None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.Name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Invoice Number">
            <input name="invoiceNumber" placeholder="INV-0009" className={inputCls} />
          </Field>
          <Field label="Amount ($)">
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className={inputCls}
              required
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Type">
            <select name="invoiceType" className={selectCls} defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              <option value="deposit">Deposit</option>
              <option value="milestone">Milestone</option>
              <option value="final">Final</option>
              <option value="recurring">Recurring</option>
              <option value="one_off">One-off</option>
            </select>
          </Field>
          <Field label="Status">
            <select name="status" className={selectCls} defaultValue="Draft">
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
              <option value="Void">Void</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Issue Date">
            <input name="issueDate" type="date" defaultValue={today} className={inputCls} />
          </Field>
          <Field label="Due Date">
            <input name="dueDate" type="date" className={inputCls} />
          </Field>
        </div>
        <Field label="Notes">
          <input name="notes" placeholder="Optional" className={inputCls} />
        </Field>
        <SubmitRow pending={pending} onClose={onClose} accent="#bfff3a" />
      </form>
    </ModalShell>
  );
}

function ExpenseModal({ onClose }: { onClose: () => void }) {
  const [pending, start] = useTransition();
  const today = format(new Date(), "yyyy-MM-dd");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = fd.get("amount") as string;
    const usdAmount = fd.get("usdAmount") as string;
    const category = (fd.get("category") as string) || "";
    start(async () => {
      try {
        await createExpenseAction({
          Name: fd.get("name") as string,
          Category: category ? (category as ExpenseCategoryValue) : undefined,
          Amount: amount ? parseFloat(amount) : undefined,
          Date: (fd.get("date") as string) || undefined,
          Recurring: fd.get("recurring") === "on",
          Notes: (fd.get("notes") as string) || undefined,
          "USD Amount": usdAmount ? parseFloat(usdAmount) : undefined,
          Reference: (fd.get("reference") as string) || undefined,
        });
        toast.success("Expense created");
        onClose();
      } catch {
        toast.error("Failed to create expense");
      }
    });
  }

  return (
    <ModalShell title="New Expense" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name">
            <input
              name="name"
              placeholder="e.g. Figma subscription"
              className={inputCls}
              required
            />
          </Field>
          <Field label="Amount (TTD)">
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className={inputCls}
              required
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="USD Amount">
            <input
              name="usdAmount"
              type="number"
              min="0"
              step="0.01"
              placeholder="Optional"
              className={inputCls}
            />
          </Field>
          <Field label="Reference">
            <input
              name="reference"
              placeholder="Invoice / receipt no."
              className={inputCls}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category">
            <select name="category" className={selectCls} defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              <option value="Software">Software</option>
              <option value="Subcontractors">Subcontractors</option>
              <option value="Hosting">Hosting</option>
              <option value="Hardware">Hardware</option>
              <option value="Marketing">Marketing</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Date">
            <input name="date" type="date" defaultValue={today} className={inputCls} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
          <input name="recurring" type="checkbox" className="w-3.5 h-3.5 accent-[#bfff3a]" />
          Recurring expense
        </label>
        <Field label="Notes">
          <input name="notes" placeholder="Optional" className={inputCls} />
        </Field>
        <SubmitRow pending={pending} onClose={onClose} accent="#ff4d8b" />
      </form>
    </ModalShell>
  );
}

function ProjectModal({
  clients,
  onClose,
}: {
  clients: Client[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [paymentStructure, setPaymentStructure] = useState<string>("");
  const today = format(new Date(), "yyyy-MM-dd");

  const isRecurring =
    paymentStructure === "recurring_monthly" || paymentStructure === "recurring_custom";
  const isDepositFinal = paymentStructure === "deposit_final";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const totalValue = fd.get("totalValue") as string;
    const recurringAmount = fd.get("recurringAmount") as string;
    const depositPct = fd.get("depositPct") as string;
    const clientId = (fd.get("clientId") as string) || "";
    const status = (fd.get("status") as string) || "Lead";
    const paymentStructureField = (fd.get("paymentStructure") as string) || "";
    const recurringFreq = (fd.get("recurringFreq") as string) || "";

    start(async () => {
      try {
        await createProjectAction({
          Name: fd.get("name") as string,
          Status: status as ProjectStatusValue,
          "Payment Structure": paymentStructureField
            ? (paymentStructureField as PaymentStructureValue)
            : undefined,
          "Total Value": totalValue ? parseFloat(totalValue) : undefined,
          "Recurring Amount": recurringAmount ? parseFloat(recurringAmount) : undefined,
          "Recurring Frequency": recurringFreq
            ? (recurringFreq as RecurringFrequencyValue)
            : undefined,
          "Deposit Percentage": depositPct ? parseFloat(depositPct) : undefined,
          "Start Date": (fd.get("startDate") as string) || undefined,
          Notes: (fd.get("notes") as string) || undefined,
          Owner: (fd.get("owner") as string) || undefined,
          "Service Type": (fd.get("serviceType") as string) || undefined,
          Client: clientId ? [clientId] : undefined,
        });
        toast.success("Project created");
        onClose();
      } catch {
        toast.error("Failed to create project");
      }
    });
  }

  return (
    <ModalShell title="New Project" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Project Name">
          <input
            name="name"
            placeholder="e.g. Brand redesign for Acme"
            className={inputCls}
            required
          />
        </Field>
        <Field label="Client">
          <select name="clientId" className={selectCls} defaultValue="">
            <option value="">— None</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.Company || c.Name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Status">
            <select name="status" className={selectCls} defaultValue="Lead">
              <option value="Lead">Lead</option>
              <option value="In Progress">In Progress</option>
              <option value="Review">Review</option>
              <option value="Done">Done</option>
            </select>
          </Field>
          <Field label="Payment Structure">
            <select
              name="paymentStructure"
              className={selectCls}
              defaultValue=""
              onChange={(e) => setPaymentStructure(e.target.value)}
            >
              <option value="" disabled>
                Select…
              </option>
              <option value="one_time">One-time</option>
              <option value="deposit_final">Deposit + Final</option>
              <option value="milestones">Milestones</option>
              <option value="recurring_monthly">Recurring monthly</option>
              <option value="recurring_custom">Recurring custom</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Total Value ($)">
            <input
              name="totalValue"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className={inputCls}
            />
          </Field>
          <Field label="Start Date">
            <input name="startDate" type="date" defaultValue={today} className={inputCls} />
          </Field>
        </div>
        {isRecurring && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Recurring Amount ($)">
              <input
                name="recurringAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
            <Field label="Frequency">
              <select name="recurringFreq" className={selectCls} defaultValue="monthly">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>
          </div>
        )}
        {isDepositFinal && (
          <Field label="Deposit Percentage (e.g. 50)">
            <input
              name="depositPct"
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="50"
              className={inputCls}
            />
          </Field>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Owner">
            <select name="owner" className={selectCls} defaultValue="">
              <option value="">—</option>
              <option value="M">M</option>
              <option value="Partner">Partner</option>
              <option value="Both">Both</option>
            </select>
          </Field>
          <Field label="Service Type">
            <select name="serviceType" className={selectCls} defaultValue="">
              <option value="">—</option>
              <option value="Web Dev">Web Dev</option>
              <option value="Automation">Automation</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <input name="notes" placeholder="Optional" className={inputCls} />
        </Field>
        <SubmitRow pending={pending} onClose={onClose} accent="#c44dff" />
      </form>
    </ModalShell>
  );
}

// String-literal aliases reused above. Keeping them local avoids adding
// runtime exports from the airtable lib for things the modals already
// know how to constrain.
type InvoiceTypeValue = "deposit" | "milestone" | "final" | "recurring" | "one_off";
type InvoiceStatusValue = "Draft" | "Sent" | "Paid" | "Overdue" | "Void";
type ExpenseCategoryValue =
  | "Software"
  | "Subcontractors"
  | "Hosting"
  | "Hardware"
  | "Marketing"
  | "Other";
type ProjectStatusValue = "Lead" | "In Progress" | "Review" | "Done" | "Cancelled";
type PaymentStructureValue =
  | "one_time"
  | "deposit_final"
  | "milestones"
  | "recurring_monthly"
  | "recurring_custom";
type RecurringFrequencyValue = "monthly" | "quarterly" | "yearly";

export function QuickActions({ clients = [], projects = [] }: Props) {
  const [open, setOpen] = useState<ModalKind>(null);

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setOpen("invoice")}
          className="min-h-11 sm:min-h-0 text-xs px-3 py-1.5 bg-[#1a1d22] text-[#bfff3a] border border-[#2a2e34] rounded-full font-medium hover:bg-[#2a2e34] transition-colors"
        >
          + Invoice
        </button>
        <button
          onClick={() => setOpen("expense")}
          className="min-h-11 sm:min-h-0 text-xs px-3 py-1.5 bg-[#1a1d22] text-zinc-400 border border-[#2a2e34] rounded-full hover:text-white hover:bg-[#2a2e34] transition-colors"
        >
          + Expense
        </button>
        <button
          onClick={() => setOpen("project")}
          className="min-h-11 sm:min-h-0 text-xs px-3 py-1.5 bg-[#1a1d22] text-zinc-400 border border-[#2a2e34] rounded-full hover:text-white hover:bg-[#2a2e34] transition-colors"
        >
          + Project
        </button>
      </div>

      {open === "invoice" && <InvoiceModal projects={projects} onClose={() => setOpen(null)} />}
      {open === "expense" && <ExpenseModal onClose={() => setOpen(null)} />}
      {open === "project" && <ProjectModal clients={clients} onClose={() => setOpen(null)} />}
    </>
  );
}
