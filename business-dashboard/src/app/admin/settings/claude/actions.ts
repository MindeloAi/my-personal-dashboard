"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { revokeAllForUser } from "@/lib/oauth-db";

/** Disconnect Claude for the signed-in founder only: every live token of theirs is revoked. */
export async function disconnectClaudeAction(): Promise<{ ok: true; revoked: number } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  try {
    const revoked = await revokeAllForUser(admin.id);
    revalidatePath("/admin/settings/claude");
    return { ok: true, revoked };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "That did not work. Try again, and tell Claude if it keeps happening." };
  }
}
