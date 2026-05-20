import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, expectedToken, tokenMatches } from "@/app/login/auth";

// NOTE: In Next.js 16 the `middleware` file convention is deprecated and was
// renamed to `proxy` (see node_modules/next/dist/docs/01-app/.../proxy.md).
// Issue #3 was written against the old `middleware.ts` name; this is the
// current equivalent. The behaviour is identical.

/**
 * Gate the dashboard only. `/login`, `/intake`, `/healthz`, and static assets
 * are left public via the `matcher` below (it only runs proxy on /dashboard).
 * An unauthenticated dashboard request is redirected to /login.
 */
export async function proxy(request: NextRequest) {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const authed = tokenMatches(cookie, await expectedToken());

  if (!authed) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Only run on the dashboard; everything else (login, intake, healthz,
  // static assets) stays public. Both entries cover the bare `/dashboard`
  // path and any nested route under it.
  matcher: ["/dashboard", "/dashboard/:path*"],
};
