import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { createClient, getPendingAdmin } from "@/lib/auth";
import { dashboardFont } from "@/lib/dashboard-font";
import { safeNext } from "@/lib/oauth";
import { SetupForm, type SetupState } from "./setup-form";

export const dynamic = "force-dynamic";

// First sign-in after two-step sign-in was switched on: set up an authenticator.
// Every admin must; there is no skip.

async function confirm(_prev: SetupState, formData: FormData): Promise<SetupState> {
  "use server";
  const next = safeNext(String(formData.get("next") ?? ""));
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { error: "Type the 6-digit code from your app." };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  // Returning state (not redirecting) keeps the same QR code on screen after a typo.
  if (error) return { error: "That code didn't work. Try the newest one." };
  redirect(next ?? "/admin/overview");
}

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);

  const pending = await getPendingAdmin();
  if (!pending) redirect("/login");
  if (pending.step === "done") redirect(next ?? "/admin/overview");
  if (pending.step === "code") redirect(`/login/code${next ? `?next=${encodeURIComponent(next)}` : ""}`);

  // A setup abandoned half way leaves an unverified factor. Clear it before starting again.
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Mindelo" });

  return (
    <div className={`${dashboardFont.className} min-h-screen bg-[#F3F5F8] text-[#1B2533] flex items-center justify-center p-6`}>
      <div className="w-full max-w-sm space-y-4 bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-6">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-[#1B2533]">Set up two-step sign-in</p>
          <p className="text-xs text-[#5A6678]">For {pending.admin.email}. You only do this once.</p>
        </div>
        {error || !data ? (
          <p className="text-xs text-[#B23A0A]">Couldn&apos;t start setup: {error?.message ?? "no response"}. Try again in a minute.</p>
        ) : (
          <SetupForm
            action={confirm}
            factorId={data.id}
            qr={data.totp.qr_code}
            secret={data.totp.secret}
            next={next ?? ""}
            shared={pending.admin.email.toLowerCase() === "admin@mindelo.site"}
          />
        )}
        <form action={signOutAction}>
          <button type="submit" className="w-full text-xs text-[#5A6678] hover:text-[#1B2533]">
            Use a different account
          </button>
        </form>
      </div>
    </div>
  );
}
