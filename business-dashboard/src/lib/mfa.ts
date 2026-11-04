// Two-step sign-in. Pure, so it can be tested without Supabase.

export type Step = "done" | "code" | "setup";
type Aal = { currentLevel: string | null; nextLevel: string | null };

/**
 * done: password and code both given this session.
 * code: an authenticator is set up, the code is still owed.
 * setup: no authenticator yet; every admin must set one up.
 */
export function nextStep(aal: Aal): Step {
  if (aal.currentLevel === "aal2") return "done";
  if (aal.nextLevel === "aal2") return "code";
  return "setup";
}

export const STEP_PATH: Record<Exclude<Step, "done">, string> = { code: "/login/code", setup: "/login/setup" };
