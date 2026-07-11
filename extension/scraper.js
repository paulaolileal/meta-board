(function scrapeInstagramPost() {
  function text(el) {
    return el ? el.textContent.trim() : undefined;
  }

  function extractMentions(str) {
    if (!str) return [];
    const matches = str.match(/@[\w.]+/g) || [];
    return [...new Set(matches)];
  }

  function extractLinks(str) {
    if (!str) return [];
    const matches = str.match(/https?:\/\/[^\s]+/g) || [];
    return [...new Set(matches)];
  }

  function unescapeJsonUrl(url) {
    return url.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  }

  // Path segments that are never a username, used to tell apart profile
  // links (e.g. "/domburgueria/") from Instagram's own routes.
  const RESERVED_PATH_SEGMENTS = new Set([
    "p",
    "reel",
    "reels",
    "stories",
    "explore",
    "accounts",
    "direct",
    "tv",
  ]);

  function usernameFromHref(href) {
    const segments = (href || "").split("/").filter(Boolean);
    if (segments.length !== 1 || RESERVED_PATH_SEGMENTS.has(segments[0])) return undefined;
    return segments[0];
  }

  function firstValidUsername(anchors) {
    for (const anchor of anchors) {
      const username = usernameFromHref(anchor.getAttribute("href"));
      if (username) return username;
    }
    return undefined;
  }

  // Instagram's DOM is unstable and unversioned; these selectors are best-effort
  // and expected to need updates when Instagram changes its markup.
  // Instagram no longer wraps post content in <article>/<header>, so we scope
  // to the whole document and gate on the URL instead.
  const isPostOrReelPage = /\/(p|reel|reels)\/[^/]+\/?/.test(window.location.pathname);
  if (!isPostOrReelPage) return null;

  // Instagram has also dropped <h1>/<h2>/<ul>/<li> from the post/comments
  // panel, so tag-based selectors can no longer find the caption or its
  // author. <time datetime> is the one semantic element Instagram keeps for
  // accessibility, and it encodes a structural fact that survives markup
  // churn: every real comment's timestamp sits inside a permalink link
  // (a[href*="/c/"]), while the caption's timestamp — rendered as the
  // list's first entry — is not wrapped in any link at all.
  function containerWithAuthorLink(timeEl) {
    let node = timeEl.parentElement;
    while (node && node !== document.body) {
      const username = firstValidUsername(node.querySelectorAll("a[href^='/']"));
      if (username) return { container: node, username };
      node = node.parentElement;
    }
    return undefined;
  }

  function entryFromTime(timeEl) {
    const found = containerWithAuthorLink(timeEl);
    if (!found) return undefined;
    const body = text(found.container.nextElementSibling);
    const isPinned = /fixad|pinned/i.test(found.container.parentElement?.textContent || "");
    return { username: found.username, body, isPinned };
  }

  const timeEls = Array.from(document.querySelectorAll("time[datetime]"));
  const captionTimeEl = timeEls.find((t) => !t.closest("a"));
  const captionEntry = captionTimeEl ? entryFromTime(captionTimeEl) : undefined;

  // Fallback for page variants where the time-based heuristic above doesn't
  // apply (older markup still using semantic tags).
  const legacyCaptionEl = document.querySelector("h1, div[data-testid='post-caption'], ul li span");

  const captionText = captionEntry?.body || text(legacyCaptionEl);

  // Username: prefer the address bar (present whenever the post/reel was
  // reached from a profile link, and immune to markup churn), then the
  // caption entry's author link, then legacy header/h2 selectors. The old
  // "a.notranslate" selector matched the wrong person: Instagram also tags
  // the "Curtido por X" liker link as notranslate, and that link sits
  // earlier in the DOM than the author's.
  const profileUsername =
    usernameFromHref(window.location.pathname.split("/").slice(0, 2).join("/")) ||
    captionEntry?.username ||
    firstValidUsername(document.querySelectorAll("header a[href^='/']")) ||
    firstValidUsername(document.querySelectorAll("h2 a[href^='/']"));

  const pinnedAuthorComments = timeEls
    .map(entryFromTime)
    .filter((entry) => entry?.body)
    .filter((entry) => entry.isPinned || (!!profileUsername && entry.username === profileUsername))
    .map((entry) => entry.body);

  // Instagram streams <video> through MediaSource Extensions, so
  // currentSrc/src is a page-local "blob:" URL that can't be fetched
  // server-side (e.g. for transcription). The real CDN mp4 URL instead
  // lives in the page's hydration JSON, embedded in inline <script> tags.
  function videoUrlFromEmbeddedJson() {
    const scripts = document.querySelectorAll("script:not([src])");
    for (const script of scripts) {
      const content = script.textContent;
      if (!content || !content.includes("video_url")) continue;
      const match = content.match(/"video_url":"([^"]+)"/);
      if (match) return unescapeJsonUrl(match[1]);
    }
    return undefined;
  }

  function videoUrlFromMeta() {
    const meta = document.querySelector(
      "meta[property='og:video:secure_url'], meta[property='og:video']",
    );
    return meta?.getAttribute("content") || undefined;
  }

  function videoUrlFromElement() {
    const videoEl = document.querySelector("video");
    const src = videoEl ? videoEl.currentSrc || videoEl.src : undefined;
    return src && !src.startsWith("blob:") ? src : undefined;
  }

  const videoUrl = videoUrlFromEmbeddedJson() || videoUrlFromMeta() || videoUrlFromElement();

  return {
    captionText,
    pinnedAuthorComments,
    mentions: extractMentions(captionText),
    links: extractLinks(captionText),
    profileUsername,
    videoUrl,
    postUrl: window.location.href,
  };
})();
