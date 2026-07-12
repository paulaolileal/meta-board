import { verifyGoogleAuth } from "../_lib/verifyGoogleAuth.js";

// Runs on the Node.js runtime (not Edge): some marketplaces (Mercado Livre,
// AliExpress) serve an anti-bot challenge page to Vercel's Edge Network IPs,
// so the Node.js serverless network path is tried instead.
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 300_000;
// Many storefronts (Shopee, etc.) render as client-side SPAs for regular browsers,
// so the initial HTML has no og:image tag. They still serve a pre-rendered page with
// full Open Graph metadata to known social-crawler user agents (for link share cards).
// Tried in order; a second crawler identity is attempted if the first yields no image,
// since some sites specifically block facebookexternalhit while allowing Googlebot.
const CRAWLER_USER_AGENTS = [
  "facebookexternalhit/1.1",
  "Googlebot/2.1 (+http://www.google.com/bot.html)",
];

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const PRIVATE_IP_PATTERN = /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractMetaContent(html: string, properties: string[]): string | null {
  const metaTags = html.match(/<meta\s+[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const propMatch = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
    const prop = propMatch?.[1]?.toLowerCase();
    if (!prop || !properties.includes(prop)) continue;
    const contentMatch = tag.match(/content\s*=\s*["']([^"']*)["']/i);
    if (contentMatch?.[1]) return decodeHtmlEntities(contentMatch[1]);
  }
  return null;
}

function isBlockedHostname(hostname: string): boolean {
  return BLOCKED_HOSTNAMES.has(hostname) || PRIVATE_IP_PATTERN.test(hostname);
}

interface PreviewResult {
  image: string | null;
  title: string | null;
}

async function fetchPreview(url: URL, userAgent: string): Promise<PreviewResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const pageResponse = await fetch(url.toString(), {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
    });

    if (!pageResponse.ok) {
      console.error(
        "Link preview upstream non-ok status",
        url.hostname,
        userAgent,
        pageResponse.status,
      );
      return null;
    }

    const fullHtml = await pageResponse.text();
    const html = fullHtml.length > MAX_HTML_BYTES ? fullHtml.slice(0, MAX_HTML_BYTES) : fullHtml;

    const image = extractMetaContent(html, ["og:image", "og:image:secure_url", "twitter:image"]);
    const title = extractMetaContent(html, ["og:title"]);

    if (!image) {
      console.error("Link preview no og:image found", url.hostname, userAgent, fullHtml.length);
    }

    return { image, title };
  } catch (error) {
    console.error("Link preview fetch failed", url.hostname, userAgent, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const auth = await verifyGoogleAuth(req);
  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status });
  }

  const targetUrl = new URL(req.url).searchParams.get("url");
  if (!targetUrl) {
    return Response.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return Response.json({ error: "Invalid url" }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return Response.json({ error: "Invalid url protocol" }, { status: 400 });
  }
  if (isBlockedHostname(parsed.hostname.toLowerCase())) {
    return Response.json({ error: "Invalid url host" }, { status: 400 });
  }

  let result: PreviewResult = { image: null, title: null };
  for (const userAgent of CRAWLER_USER_AGENTS) {
    const attempt = await fetchPreview(parsed, userAgent);
    if (attempt) result = attempt;
    if (attempt?.image) break;
  }

  return Response.json(result, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
