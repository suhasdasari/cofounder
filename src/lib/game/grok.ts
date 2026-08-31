import { clampScore } from "./valuation";

const MODEL = "grok-4.5";

async function chat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { max_tokens: number; json?: boolean },
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "AI is not available in this environment" };
  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    max_tokens: opts.max_tokens,
    temperature: 0.7,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: `xAI API error ${res.status}` };
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) return { ok: false, error: "Empty model response" };
  return { ok: true, text };
}

export async function grokRoast(input: {
  pitch: string;
  url: string | null;
  title: string | null;
  description: string | null;
  h1: string | null;
}): Promise<{ ok: true; roast: string } | { ok: false; error: string }> {
  const facts = [
    `Pitch: ${input.pitch}`,
    input.url ? `URL: ${input.url}` : null,
    input.title ? `Scraped title: ${input.title}` : null,
    input.description ? `Scraped meta: ${input.description}` : null,
    input.h1 ? `Scraped h1: ${input.h1}` : null,
    !input.title && input.url ? "Could not read the page. Roast the pitch text only. Do not pretend you visited." : null,
  ]
    .filter(Boolean)
    .join("\n");

  const r = await chat(
    [
      {
        role: "system",
        content:
          "You are a brutal, elite cofounder. Roast the startup in exactly two short sentences. Be specific, mean, funny. No greeting, no questions, no hashtags, no emoji. If scraped fields exist, use them so it is obvious you read the product.",
      },
      { role: "user", content: facts },
    ],
    { max_tokens: 120 },
  );
  if (!r.ok) return r;
  const roast = r.text.replace(/^["']|["']$/g, "").slice(0, 420);
  return { ok: true, roast };
}

export type ScoreOut = {
  n: number;
  c: number;
  m: number;
  quote: string;
  line: string;
};

export async function grokScore(input: {
  pitch: string;
  roast: string;
  clapback: string;
  url: string | null;
  title: string | null;
  steal?: { clapback: string; valuation: number } | null;
  defend?: string | null;
}): Promise<{ ok: true; score: ScoreOut } | { ok: false; error: string }> {
  const user = [
    `Pitch: ${input.pitch}`,
    input.url ? `URL: ${input.url}` : "",
    input.title ? `Title: ${input.title}` : "",
    `Roast: ${input.roast}`,
    `Clapback: ${input.clapback}`,
    input.steal
      ? `A challenger scored $${input.steal.valuation} with: ${input.steal.clapback}`
      : "",
    input.defend ? `Founder defend: ${input.defend}` : "",
    "Score integers 0-10 only. Be stingy. Default low. Novelty n, clapback charisma/proof c, market m. quote = one savage highlight. line = one sentence verdict.",
  ]
    .filter(Boolean)
    .join("\n");

  const r = await chat(
    [
      {
        role: "system",
        content:
          'Return JSON only: {"n":0-10,"c":0-10,"m":0-10,"quote":"...","line":"..."}. n=novelty/moat, c=clapback proof/humor, m=market size. Most ideas score n<=4 c<=4. Revenue proof can raise c. Do not output a dollar amount.',
      },
      { role: "user", content: user },
    ],
    { max_tokens: 180, json: true },
  );
  if (!r.ok) return r;
  try {
    const parsed = JSON.parse(r.text) as Partial<ScoreOut>;
    return {
      ok: true,
      score: {
        n: clampScore(Number(parsed.n)),
        c: clampScore(Number(parsed.c)),
        m: clampScore(Number(parsed.m)),
        quote: String(parsed.quote ?? "").slice(0, 180),
        line: String(parsed.line ?? "").slice(0, 180),
      },
    };
  } catch {
    return { ok: false, error: "Could not parse score" };
  }
}
