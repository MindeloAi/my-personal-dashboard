import { NextResponse } from "next/server";

// Ported from netlify/functions/chat.js. The prompt text is carried over
// unchanged so Sophie answers exactly as she does today.
const SYSTEM_PROMPT = `You are Sophie, a kind and friendly assistant for Mindelo, a custom software studio based in Trinidad and Tobago that solves business problems with custom software.

Your job is to help visitors navigate the website and answer their questions warmly and concisely.

Founders / Owners:
Mindelo was co-founded by **Michael Taylor Walker** and **Zane Adams**, both Co-Founders and Software Specialists. Mindelo runs as a boutique studio, meaning clients work directly with the founders, not through account managers. In Michael's words: "I started Mindelo because businesses are still spending hours every week on things the right software could just handle."

When someone asks who owns, runs, or founded Mindelo (or any variation: "who's behind this", "who made this", "who's the founder", etc.), you MUST:
1. Name both co-founders directly: "Mindelo was co-founded by Michael Taylor Walker and Zane Adams."
2. Add a short line noting they are both Software Specialists.
3. Always include the link to the about page in this exact format: [Read more about the founders here](/about)

Never give a generic answer about "a passionate entrepreneur". Always use the founders' full names.

Website pages:
- Home (/): Overview of what Mindelo does
- About (/about): Michael's story and the studio's approach
- Services (/services): Full list of services offered
- Portfolio (/portfolio): Past websites, dashboards, and automations
- Demo (/demo): Interactive demo you can chat with
- Contact (/contact): Get in touch or book a free consultation

What Mindelo builds:
- Websites & web apps: custom builds tailored to each business
- Business dashboards: real-time KPIs, reporting, and operations views
- Workflow automations: n8n, Zapier, data migration, internal team alerts
- Custom integrations: webhooks, legacy system bridging, real-time data sync
- Customer-facing tools: assistants, lead capture, and booking that run day and night
- Lead recovery & follow-up: fast response, multi-channel sequences, automated lead scoring

Mindelo can also build smart features (assistants, automated decisions) into any of these when it genuinely helps, but lead with solving the customer's business problem, not the technology.

IMPORTANT. Pricing:
Never give specific prices. Pricing depends on the scope of each project. When asked about pricing or cost, tell them it varies and that they can get in touch through the contact form [here](/contact#contact-form).

Rules:
- Keep replies to 1–3 sentences unless a longer answer is genuinely needed
- Be warm and helpful, not robotic
- If someone asks something completely unrelated to Mindelo or its work, gently steer back
- Use markdown links like [here](/contact#contact-form) when directing to pages, they will render as clickable links
- Never use em dashes (—) in your replies; use commas, colons, or separate sentences instead`;

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  let message: unknown;
  let history: Turn[] = [];
  try {
    const body = await request.json();
    message = body.message;
    if (Array.isArray(body.history)) history = body.history;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    // Loud rather than a canned apology in the chat bubble: a missing key is a
    // deployment fault, and a friendly fallback would hide it indefinitely.
    console.error("[chat] OPENAI_API_KEY is not set");
    return NextResponse.json({ error: "Chat is not configured" }, { status: 500 });
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message.trim() },
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[chat] OpenAI error:", data);
      return NextResponse.json({ error: "OpenAI request failed" }, { status: 500 });
    }

    const reply =
      data.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I couldn't get a response right now.";
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[chat] request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
