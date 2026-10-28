import { redirect } from "next/navigation";
import { createClient, getAdmin } from "@/lib/auth";
import { dashboardFont } from "@/lib/dashboard-font";

export const dynamic = "force-dynamic";

// Sign in with Supabase Auth. Email and password only, no magic links, no OAuth.
//
// There is no signup, no password reset and no invite flow here, on purpose. The
// three founder accounts are seeded by scripts/seed-admins.mjs and public signup is
// disabled at the Supabase project level.

async function signIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=missing");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // One message for a wrong password and for an address that has no account.
  // Distinguishing them would let anyone enumerate who has access.
  if (error) redirect("/login?error=invalid");

  // A valid account is not enough: without an admin profile the admin pages
  // would bounce straight back here. Sign out so the form isn't stuck in a loop.
  if (!(await getAdmin())) {
    await supabase.auth.signOut();
    redirect("/login?error=unauthorised");
  }

  redirect("/admin/overview");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Already signed in and authorised: skip the form.
  const admin = await getAdmin();
  if (admin) redirect("/admin/overview");

  return (
    <div className={`${dashboardFont.className} min-h-screen bg-[#F3F5F8] text-[#1B2533] flex items-center justify-center p-6`}>
      <form
        action={signIn}
        className="w-full max-w-sm space-y-4 bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-6"
      >
        <div className="space-y-1">
          <p className="text-lg font-semibold text-[#1B2533]">Mindelo Dashboard</p>
          <p className="text-xs text-[#5A6678]">Sign in to continue.</p>
        </div>

        {error === "invalid" && (
          <p className="text-xs text-[#B23A0A]">
            That email and password combination was not recognised.
          </p>
        )}
        {error === "unauthorised" && (
          <p className="text-xs text-[#B23A0A]">This account does not have dashboard access.</p>
        )}
        {error === "missing" && (
          <p className="text-xs text-[#B23A0A]">Enter both an email and a password.</p>
        )}
        {error === "config" && (
          <p className="text-xs text-[#B45309]">
            Supabase auth is not configured on this deployment. Set
            NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#4A5568]" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            required
            className="w-full rounded-[4px] bg-[#F3F5F8] border border-[#DCE1E8] px-3 py-2 text-sm outline-none focus:border-[#1D4ED8]/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#4A5568]" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-[4px] bg-[#F3F5F8] border border-[#DCE1E8] px-3 py-2 text-sm outline-none focus:border-[#1D4ED8]/40"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-[4px] bg-[#1D4ED8] text-white text-sm font-semibold px-3 py-2 hover:bg-[#1D4ED8]/90 transition-colors"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
