"use client";

import { useState, useTransition } from "react";
import { submitIntakeAction } from "@/app/actions";

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#bfff3a]/50 transition-colors";
const selectCls = inputCls + " cursor-pointer";

const SERVICE_OPTIONS = [
  "Website / Web Dev",
  "Automation",
  "Web Dev + Automation",
  "Not sure yet",
];

const BUDGET_OPTIONS = [
  "Under $1,000",
  "$1,000 – $3,000",
  "$3,000 – $7,000",
  "$7,000+",
  "Not sure yet",
];

export default function IntakePage() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(false);
    start(async () => {
      try {
        await submitIntakeAction({
          Name: (fd.get("name") as string) || undefined,
          "Business Name": (fd.get("businessName") as string) || undefined,
          Email: (fd.get("email") as string) || undefined,
          "Phone/WhatsApp": (fd.get("phone") as string) || undefined,
          "Service Interest": (fd.get("serviceInterest") as string) || undefined,
          "Current Website": (fd.get("currentWebsite") as string) || undefined,
          "Budget Range": (fd.get("budgetRange") as string) || undefined,
          Message: (fd.get("message") as string) || undefined,
          Source: "Intake form",
        });
        setDone(true);
      } catch {
        setError(true);
      }
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#0b0d10]">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <p className="text-[#bfff3a] text-sm font-semibold tracking-wider uppercase mb-2">
            Mindelo
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Let&apos;s build something</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Tell us about your project: web development, automation, or both. We&apos;ll get back
            to you within a couple of days.
          </p>
        </div>

        {done ? (
          <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#bfff3a]/10 border border-[#bfff3a]/20 flex items-center justify-center mx-auto mb-4 text-2xl">
              ✓
            </div>
            <p className="text-lg font-semibold text-white">Thanks, we got it.</p>
            <p className="text-sm text-zinc-400 mt-2">
              Your details are in. We&apos;ll reach out soon to talk through your project.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 sm:p-8 flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-xs text-zinc-400">
                  Name <span className="text-[#ff4d8b]">*</span>
                </label>
                <input id="name" name="name" className={inputCls} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="businessName" className="text-xs text-zinc-400">
                  Business
                </label>
                <input id="businessName" name="businessName" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs text-zinc-400">
                  Email <span className="text-[#ff4d8b]">*</span>
                </label>
                <input id="email" name="email" type="email" className={inputCls} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="phone" className="text-xs text-zinc-400">
                  Phone / WhatsApp
                </label>
                <input id="phone" name="phone" type="tel" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="serviceInterest" className="text-xs text-zinc-400">
                  Service Interest
                </label>
                <select id="serviceInterest" name="serviceInterest" defaultValue="" className={selectCls}>
                  <option value="">Select…</option>
                  {SERVICE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="budgetRange" className="text-xs text-zinc-400">
                  Budget Range
                </label>
                <select id="budgetRange" name="budgetRange" defaultValue="" className={selectCls}>
                  <option value="">Select…</option>
                  {BUDGET_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="currentWebsite" className="text-xs text-zinc-400">
                Current Website
              </label>
              <input
                id="currentWebsite"
                name="currentWebsite"
                placeholder="https:// (if you have one)"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="message" className="text-xs text-zinc-400">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                placeholder="What are you looking to build?"
                className={inputCls}
              />
            </div>

            {error && (
              <p className="text-xs text-[#ff4d8b]">
                Something went wrong. Please try again, or email us directly.
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-2 w-full py-3 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80"
            >
              {pending ? "Sending…" : "Send it over"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
