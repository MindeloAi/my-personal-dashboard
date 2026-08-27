// src/app/login/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, hashPasscode } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const passcode = process.env.DASHBOARD_PASSCODE;
  if (!passcode) redirect("/login?reason=unconfigured");

  const entered = String(formData.get("passcode") ?? "");
  if (entered !== passcode) redirect("/login?reason=invalid");

  const store = await cookies();
  store.set(AUTH_COOKIE, await hashPasscode(passcode), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/overview");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <div className="min-h-screen bg-[#0b0d10] text-white flex items-center justify-center p-6">
      <form
        action={login}
        className="w-full max-w-sm space-y-4 bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6"
      >
        <div className="space-y-1">
          <p className="text-lg font-semibold text-[#f5f5f5]">MindeloAI Dashboard</p>
          <p className="text-xs text-zinc-500">Enter the shared passcode to continue.</p>
        </div>

        {reason === "invalid" && (
          <p className="text-xs text-[#ff4d8b]">That passcode is not correct.</p>
        )}
        {reason === "unconfigured" && (
          <p className="text-xs text-[#fbbf24]">
            DASHBOARD_PASSCODE is not set on this deployment, so login is impossible.
            Set it in the environment and redeploy.
          </p>
        )}

        <input
          name="passcode"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-lg bg-[#0b0d10] border border-[#2a2e34] px-3 py-2 text-sm outline-none focus:border-[#bfff3a]/40"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-[#bfff3a] text-black text-sm font-semibold px-3 py-2 hover:bg-[#bfff3a]/90 transition-colors"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
