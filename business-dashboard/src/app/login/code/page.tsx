import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { createClient, getPendingAdmin } from "@/lib/auth";
import { dashboardFont } from "@/lib/dashboard-font";
import { safeNext } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// Second step of signing in: the 6-digit code from the founder's authenticator app.

async function verify(formData: FormData) {
  "use server";
  const next = safeNext(String(formData.get("next") ?? ""));
  const keep = next ? `&next=${encodeURIComponent(next)}` : "";
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) redirect(`/login/code?error=bad${keep}`);

  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (listError || !factor) redirect(`/login/code?error=failed${keep}`);

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) redirect(`/login/code?error=bad${keep}`);
  redirect(next ?? "/admin/overview");
}

export default async function CodePage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);

  const pending = await getPendingAdmin();
  if (!pending) redirect("/login");
  if (pending.step === "done") redirect(next ?? "/admin/overview");
  if (pending.step === "setup") redirect(`/login/setup${next ? `?next=${encodeURIComponent(next)}` : ""}`);

  return (
    <div className={`${dashboardFont.className} min-h-screen bg-[#F3F5F8] text-[#1B2533] flex items-center justify-center p-6`}>
      <div className="w-full max-w-sm space-y-4 bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-6">
        <form action={verify} className="space-y-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-[#1B2533]">Enter your code</p>
            <p className="text-xs text-[#5A6678]">
              Open your authenticator app and type the 6-digit code for {pending.admin.email}.
            </p>
          </div>

          <input type="hidden" name="next" value={next ?? ""} />

          {sp.error === "bad" && <p className="text-xs text-[#B23A0A]">That code didn&apos;t work. Try the newest one.</p>}
          {sp.error === "failed" && <p className="text-xs text-[#B23A0A]">Couldn&apos;t check that code. Try again.</p>}

          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            autoFocus
            required
            aria-label="6-digit code"
            className="w-full rounded-[4px] bg-[#F3F5F8] border border-[#DCE1E8] px-3 py-2 text-lg tracking-[0.3em] text-center outline-none focus:border-[#1D4ED8]/40"
          />

          <button
            type="submit"
            className="w-full rounded-[4px] bg-[#1D4ED8] text-white text-sm font-semibold px-3 py-2 hover:bg-[#1D4ED8]/90 transition-colors"
          >
            Continue
          </button>
        </form>
        <form action={signOutAction}>
          <button type="submit" className="w-full text-xs text-[#5A6678] hover:text-[#1B2533]">
            Use a different account
          </button>
        </form>
      </div>
    </div>
  );
}
