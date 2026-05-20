"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, expectedToken } from "./auth";

/**
 * Compares the submitted passcode against DASHBOARD_PASSCODE. On match, sets an
 * httpOnly session cookie (one shared passcode for both partners) and redirects
 * to the dashboard. On mismatch, redirects back to /login with an error flag.
 */
export async function login(formData: FormData) {
  const submitted = String(formData.get("passcode") ?? "");
  const token = await expectedToken();

  if (token && submitted === process.env.DASHBOARD_PASSCODE) {
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    redirect("/dashboard");
  }

  redirect("/login?error=1");
}
