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

  const captionEl = document.querySelector("h1, div[data-testid='post-caption'], ul li span");
  const captionText = text(captionEl);

  // Username: prefer the address bar (present whenever the post/reel was
  // reached from a profile link, and immune to markup churn), then the
  // header's profile link, then the caption block's author link. The old
  // "a.notranslate" selector matched the wrong person: Instagram also tags
  // the "Curtido por X" liker link as notranslate, and that link sits
  // earlier in the DOM than the author's.
  const profileUsername =
    usernameFromHref(window.location.pathname.split("/").slice(0, 2).join("/")) ||
    firstValidUsername(document.querySelectorAll("header a[href^='/']")) ||
    firstValidUsername(document.querySelectorAll("h2 a[href^='/']"));

  const commentEls = Array.from(document.querySelectorAll("ul li"));
  const pinnedAuthorComments = commentEls
    .filter((li) => {
      const label = li.textContent || "";
      const isPinned = /fixad|pinned/i.test(label);
      const isAuthor =
        !!profileUsername && li.querySelector(`a[href="/${profileUsername}/"]`) !== null;
      return isPinned || isAuthor;
    })
    .map((li) => text(li))
    .filter(Boolean);

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
