export type PageBits = {
  title: string | null;
  description: string | null;
  h1: string | null;
};

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

export function detectUrl(raw: string): string | null {
  const t = raw.trim();
  const m = t.match(/https?:\/\/[^\s]+/i) || t.match(/\b[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?/i);
  if (!m) return null;
  try {
    const u = new URL(m[0].startsWith("http") ? m[0] : `https://${m[0]}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (isPrivateHost(u.hostname)) return null;
    return u.href.slice(0, 240);
  } catch {
    return null;
  }
}

function pickMeta(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    "i",
  );
  return (html.match(re)?.[1] || html.match(re2)?.[1] || "").trim().slice(0, 180) || null;
}

export async function scrapePage(url: string): Promise<PageBits> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 1500);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "cofounder.lol/1.0 (preview fetch; +https://cofounder.lol)" },
    });
    if (!res.ok) return { title: null, description: null, h1: null };
    const html = (await res.text()).slice(0, 80_000);
    const title =
      pickMeta(html, "og:title") ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim().slice(0, 140) ||
      null;
    const description =
      pickMeta(html, "og:description") || pickMeta(html, "description");
    const h1 = html.match(/<h1[^>]*>([^<]{2,160})<\/h1>/i)?.[1]?.trim() || null;
    return { title, description, h1 };
  } catch {
    return { title: null, description: null, h1: null };
  } finally {
    clearTimeout(t);
  }
}
