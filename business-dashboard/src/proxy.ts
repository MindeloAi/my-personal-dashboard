import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ─── Route guard ──────────────────────────────────────────────────────────────
//
// Next 16 renamed the `middleware` convention to `proxy`. This file sits beside
// `app/`, exports a function named `proxy`, and a `config.matcher`.
//
// DELIBERATELY DOES NOT IMPORT @/lib/auth OR @/lib/db. This runs on the Edge
// runtime, where the `postgres` driver cannot load. The admin-role check lives in
// requireAdmin() (Node runtime) instead. Here we only answer "is there a valid
// session?", which is enough to decide whether to render a page or bounce.
//
// TWO THINGS THIS DOES NOT DO, both handled elsewhere:
//
// 1. It does not authorise. A valid session with no `profiles` row still gets
//    redirected, but that decision is made by the page/action via requireAdmin().
// 2. It does not protect Server Actions. Those are POST requests to the page's
//    own URL and the matcher does see them, but relying on that is fragile: an
//    action can be invoked against any route. Every mutating action calls
//    requireAdmin() itself. See src/app/actions.ts.

export async function proxy(request: NextRequest) {
  // Start from a pass-through response so Supabase can attach refreshed session
  // cookies to it. The session is refreshed on every request; without this the
  // user is silently logged out when the access token expires.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser(), not getSession(). getSession() trusts the cookie without checking
  // it against the auth server, so it can be forged. This must stay getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Guard the dashboard and nothing else. Since the marketing site moved into
  // this app, the default is now PUBLIC: every route under (site), plus /login,
  // /intake and /healthz, must render to a signed-out visitor.
  //
  // Inverting the matcher this way means a new public page is public by default.
  // The previous deny-by-default matcher would have silently gated each one.
  //
  // /vault-preview is named explicitly. It is an untracked local scratch page
  // that renders vault data, and the old deny-by-default matcher covered it for
  // free. It is listed here so that inverting the default does not quietly put
  // it on the public internet.
  matcher: ["/admin/:path*", "/vault-preview/:path*"],
};
