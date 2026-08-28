import { redirect } from "next/navigation";
import { createClient, getAdmin } from "@/lib/auth";

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

  redirect("/overview");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Already signed in and authorised: skip the form.
  const admin = await getAdmin();
  if (admin) redirect("/overview");

  return (
    <div className="min-h-screen bg-[#0b0d10] text-white flex items-center justify-center p-6">
      <form
        action={signIn}
        className="w-full max-w-sm space-y-4 bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6"
      >
        <div className="space-y-1">
          <p className="text-lg font-semibold text-[#f5f5f5]">Mindelo Dashboard</p>
          <p className="text-xs text-zinc-500">Sign in to continue.</p>
        </div>

        {error === "invalid" && (
          <p className="text-xs text-[#ff4d8b]">
            That email and password combination was not recognised.
          </p>
        )}
        {error === "missing" && (
          <p className="text-xs text-[#ff4d8b]">Enter both an email and a password.</p>
        )}
        {error === "config" && (
          <p className="text-xs text-[#fbbf24]">
            Supabase auth is not configured on this deployment. Set
            NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            required
            className="w-full rounded-lg bg-[#0b0d10] border border-[#2a2e34] px-3 py-2 text-sm outline-none focus:border-[#bfff3a]/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg bg-[#0b0d10] border border-[#2a2e34] px-3 py-2 text-sm outline-none focus:border-[#bfff3a]/40"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-[#bfff3a] text-black text-sm font-semibold px-3 py-2 hover:bg-[#bfff3a]/90 transition-colors"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
