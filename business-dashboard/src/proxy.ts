// src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, hashPasscode } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const passcode = process.env.DASHBOARD_PASSCODE;

  // With no passcode configured the gate cannot be satisfied. Send the user to
  // /login, which explains that rather than silently rejecting every attempt.
  if (!passcode) {
    return NextResponse.redirect(new URL("/login?reason=unconfigured", request.url));
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await hashPasscode(passcode))) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except: the login page itself, the public lead form, the health
  // check, Next's internals, and files with an extension (favicon, images).
  matcher: ["/((?!login|intake|healthz|_next/static|_next/image|.*\\..*).*)"],
};
