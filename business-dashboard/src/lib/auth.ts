import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminProfile } from "@/lib/db";

// ─── Authentication ───────────────────────────────────────────────────────────
//
// Supabase Auth, email and password only. Two facts shape everything here:
//
// 1. There is no public signup. It is disabled at the Supabase project level, so
//    no account can be created through the API at all. Accounts are seeded by
//    scripts/seed-admins.mjs using the service role key. There is deliberately no
//    signup, password-reset or invite UI.
//
// 2. The admin role lives in the `profiles` table, never in user_metadata, which
//    the user can write to themselves through the client SDK.
//
// NOTE ON WHAT THIS DOES AND DOES NOT PROTECT. The proxy guards page navigation.
// It does NOT protect Server Actions, which are separate POST endpoints that the
// matcher never sees. Every mutating action calls requireAdmin() itself. See
// src/app/actions.ts.

/** Server-side Supabase client bound to the request's cookies. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only. The
            // proxy refreshes the session on every request, so this is safe to
            // swallow: the refreshed cookie is written there instead.
          }
        },
      },
    },
  );
}

export type AdminUser = { id: string; email: string };

/**
 * The signed-in admin, or null.
 *
 * Uses getUser() rather than getSession(): getSession() reads the cookie without
 * verifying it against the auth server, so it can be spoofed. getUser() validates
 * the JWT. Never swap this for getSession() in a security check.
 *
 * Having a valid session is not sufficient. The user must also hold a row in
 * `profiles`, which only the seeding script can create.
 */
export async function getAdmin(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const profile = await getAdminProfile(user.id);
  if (!profile) return null;

  return profile;
}

/**
 * Same, but throws. Call this at the top of every mutating Server Action.
 *
 * The thrown message is redacted by Next in production, which is fine: an
 * unauthenticated caller should learn nothing beyond "that failed".
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw new Error("Not authorised");
  return admin;
}

/**
 * Same check for READS. The proxy only proves a session exists, so a signed-in
 * user with no profiles row could otherwise read every admin page. Call it in
 * every admin page as well as the layout: a client-side navigation can render
 * a page segment without re-running its layout.
 */
export async function requireAdminPage(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/login?error=unauthorised");
  return admin;
}
