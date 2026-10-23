// Asks Claude which promises one pasted interaction contains. Reads and suggests only; it never writes.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { SuggestionOutputSchema, cleanSuggestions, textTooLong } from "./timeline";
import type { ClientPromise, Direction, EntryKind, Suggestion } from "./timeline";

export type SuggestResult =
  | { ok: true; summary: string; people: string; suggestions: Suggestion[] }
  | { ok: false; error: string };

const SYSTEM = `You read one interaction between Mindelo (a two-person software studio: Zane and Mikkey, "us") and a client, and list the promises it contains.

A promise is a commitment by one side to do or deliver something: "us" when Mindelo commits, "client" when the client commits.

Rules:
- Only list promises the text states. Never infer one from context.
- Resolve relative dates ("by Friday", "next week") against the interaction date given below. Assume a date falls on or after the interaction date unless the text says otherwise.
- For a range ("the week of 5 Oct", "9 to 10 Nov"), use the last day of the range and keep the range in "what".
- If no date is stated, or the date depends on something that has not happened yet ("3 weeks after approval"), set due_on to null and keep the wording in "what".
- If the text fulfils one of the open promises listed below, suggest "done" with its id.
- If the text changes the date or terms of an open promise, suggest "replace" with its id, and give the new "what" and due_on.
- Use "new" for anything else, with promise_id null.
- Quote the sentence each suggestion comes from, word for word.
- summary is one line, under 140 characters, saying what happened. people lists the names in the text.`;

const FAILED = "Could not get suggestions. You can add the promises by hand.";
const fail = (error: string): SuggestResult => ({ ok: false, error });

export async function suggestPromises(input: {
  clientName: string;
  occurredOn: string;
  kind: EntryKind;
  direction: Direction;
  text: string;
  open: ClientPromise[];
}): Promise<SuggestResult> {
  const tooLong = textTooLong(input.text);
  if (tooLong) return fail(tooLong);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[suggest] ANTHROPIC_API_KEY is not set");
    return fail("Suggestions need ANTHROPIC_API_KEY on the server. Add the promises by hand.");
  }

  const weekday = new Date(input.occurredOn + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const open = input.open
    .filter((p) => p.status === "open")
    .map((p) => `${p.id} | ${p.owedBy} | ${p.what} | ${p.dueOn ?? "no date"}`)
    .join("\n");
  const user = [
    `Interaction date: ${input.occurredOn} (${weekday})`,
    `Kind: ${input.kind}`,
    `Direction: ${input.direction}`,
    `Client: ${input.clientName}`,
    `Open promises (id | owed_by | what | due_on):`,
    open || "none",
    "",
    "<text>",
    input.text,
    "</text>",
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: z.toJSONSchema(SuggestionOutputSchema) } },
      messages: [{ role: "user", content: user }],
    });
    if (res.stop_reason === "refusal") {
      console.error("[suggest] Claude refused the request", JSON.stringify(res.stop_details));
      return fail("Claude declined to read this text. Add the promises by hand.");
    }
    if (res.stop_reason === "max_tokens") {
      console.error("[suggest] output cut off at max_tokens");
      return fail(FAILED);
    }
    // A fallback switch can leave the declined model's block first, so take the last text block.
    const block = [...res.content].reverse().find((c) => c.type === "text");
    if (!block || block.type !== "text") {
      console.error(`[suggest] no text block, stop_reason ${res.stop_reason}`);
      return fail(FAILED);
    }
    const out = SuggestionOutputSchema.safeParse(JSON.parse(block.text));
    if (!out.success) {
      console.error("[suggest] output did not match the schema:", out.error.message);
      return fail(FAILED);
    }
    return { ok: true, summary: out.data.summary, people: out.data.people, suggestions: cleanSuggestions(out.data, input.open) };
  } catch (err) {
    console.error("[suggest] request failed:", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
    return fail(FAILED);
  }
}
