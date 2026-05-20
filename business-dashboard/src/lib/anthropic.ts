import Anthropic from "@anthropic-ai/sdk";

// ─── Lazy client ──────────────────────────────────────────────────────────────
//
// Built from `process.env.ANTHROPIC_API_KEY`, only when a call actually runs,
// so `import "@/lib/anthropic"` is side-effect free and the build never needs
// the key. When the key is missing we throw a typed error the automation
// launcher catches and surfaces as a graceful toast.

export class MissingAnthropicEnvError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Add it in .env.local (dev) or Railway " +
        "service variables (deploy) to run AI automations.",
    );
    this.name = "MissingAnthropicEnvError";
  }
}

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingAnthropicEnvError();
  _client = new Anthropic({ apiKey });
  return _client;
}

// Always the latest model unless a caller overrides it.
const MODEL = "claude-opus-4-7";

export type CompleteOpts = {
  /**
   * Large, stable system text (e.g. a playbook) cached across requests so
   * repeated automations within the 5-minute window only pay for it once.
   */
  cachedSystem?: string;
  /** Additional, volatile system instructions (not cached). */
  system?: string;
  /** The user turn. */
  user: string;
  maxTokens?: number;
};

/**
 * One-shot text completion. Streams (so long generations don't hit HTTP
 * timeouts) and returns the concatenated text blocks. Uses adaptive thinking
 * with medium effort — a sensible balance for one-click writing tasks.
 */
export async function complete(opts: CompleteOpts): Promise<string> {
  const client = getClient();

  // Render order is system → messages; the cached (stable) block must come
  // first so its prefix stays byte-identical across requests.
  const system: Anthropic.TextBlockParam[] = [];
  if (opts.cachedSystem) {
    system.push({
      type: "text",
      text: opts.cachedSystem,
      cache_control: { type: "ephemeral" },
    });
  }
  if (opts.system) {
    system.push({ type: "text", text: opts.system });
  }

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: system.length > 0 ? system : undefined,
    messages: [{ role: "user", content: opts.user }],
  });

  const final = await stream.finalMessage();
  return final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
