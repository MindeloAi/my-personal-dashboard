// The founder approves Claude here. Not under /admin, so the proxy does not
// guard it: this page checks the session itself and sends a signed-out founder
// to /login, which returns here afterwards.
import { redirect } from "next/navigation";
import { getAdmin, requireAdmin } from "@/lib/auth";
import { dashboardFont } from "@/lib/dashboard-font";
import { issueCode } from "@/lib/oauth-db";
import { redirectAllowed } from "@/lib/oauth";

export const dynamic = "force-dynamic";

const KEYS = ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope"] as const;
type Params = Partial<Record<(typeof KEYS)[number], string>>;

/** Only the known keys, and only single string values (a repeated key is dropped). */
function pick(source: Record<string, unknown>): Params {
  const p: Params = {};
  for (const k of KEYS) if (typeof source[k] === "string" && source[k]) p[k] = source[k] as string;
  return p;
}

/** Null when the request is acceptable; otherwise what is wrong. Never redirect to an unchecked URI. */
function problem(p: Params): string | null {
  if (!p.redirect_uri || !redirectAllowed(p.redirect_uri)) return "This sign-in link is not from Claude.";
  if (p.response_type !== "code" || !p.client_id || p.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(p.code_challenge ?? ""))
    return "This sign-in link is incomplete.";
  return null;
}

function back(redirectUri: string, params: Record<string, string | undefined>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

async function decide(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const p = pick(Object.fromEntries(formData));
  if (problem(p)) throw new Error("Bad authorization request");
  if (formData.get("allow") !== "yes") redirect(back(p.redirect_uri!, { error: "access_denied", state: p.state }));
  const code = await issueCode({ userId: admin.id, clientId: p.client_id!, redirectUri: p.redirect_uri!, codeChallenge: p.code_challenge! });
  redirect(back(p.redirect_uri!, { code, state: p.state }));
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = pick(await searchParams);
  const wrong = problem(p);
  const admin = wrong ? null : await getAdmin();
  if (!wrong && !admin) {
    const here = `/oauth/authorize?${new URLSearchParams(p).toString()}`;
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }
  return (
    <div className={`${dashboardFont.className} min-h-screen bg-[#F3F5F8] text-[#1B2533] flex items-center justify-center p-6`}>
      <div className="w-full max-w-sm space-y-4 bg-white border border-[#DCE1E8] rounded-[4px] p-6">
        {wrong ? (
          <p className="text-sm text-[#B23A0A]">{wrong}</p>
        ) : (
          <form action={decide} className="space-y-4">
            <p className="text-lg font-semibold">Connect Claude to the dashboard?</p>
            <p className="text-sm text-[#5A6678]">
              Claude will be able to read clients, projects, deals, documents and invoices, and draft and finalise documents as {admin!.email}.
              It cannot delete anything, record payments or see bank details.
            </p>
            <p className="text-xs text-[#5A6678]">You can disconnect it at any time in the dashboard under Sales, Claude.</p>
            {Object.entries(p).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <div className="flex gap-2">
              <button name="allow" value="yes" className="flex-1 rounded-[4px] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white">Allow</button>
              <button name="allow" value="no" className="flex-1 rounded-[4px] border border-[#DCE1E8] px-3 py-2 text-sm">Deny</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
