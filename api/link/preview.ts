import { verifyGoogleAuth } from "../_lib/verifyGoogleAuth.js";

export const config = { runtime: "edge" };

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 300_000;
// Many storefronts (Shopee, etc.) render as client-side SPAs for regular browsers,
// so the initial HTML has no og:image tag. They still serve a pre-rendered page with
// full Open Graph metadata to known social-crawler user agents (for link share cards).
const BROWSER_USER_AGENT = "facebookexternalhit/1.1";

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const pageResponse = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    if (!pageResponse.ok) {
      console.error("Link preview upstream non-ok status", parsed.hostname, pageResponse.status);
      return Response.json({ image: null, title: null }, { status: 200 });
    }

    const fullHtml = await pageResponse.text();
    const html = fullHtml.length > MAX_HTML_BYTES ? fullHtml.slice(0, MAX_HTML_BYTES) : fullHtml;

    const image = extractMetaContent(html, ["og:image", "og:image:secure_url", "twitter:image"]);
    const title = extractMetaContent(html, ["og:title"]);

    if (!image) {
      console.error(
        "Link preview no og:image found",
        parsed.hostname,
        fullHtml.length,
        fullHtml.slice(0, 500),
      );
    }

    return Response.json(
      { image, title },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (error) {
    console.error("Link preview failed", error);
    return Response.json({ image: null, title: null }, { status: 200 });
  } finally {
    clearTimeout(timeout);
  }
}
