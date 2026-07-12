(function scrapePage() {
  const MAX_PAGE_TEXT_LENGTH = 20000;

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

  // Site-agnostic fallback: `innerText` follows the browser's own "rendered
  // text" algorithm, which already skips <script>/<style>/display:none
  // content — so this needs no per-site parsing to be useful on any page
  // (product listings, articles, tweets, whatever the user is looking at).
  function collectPageText() {
    const raw = document.body ? document.body.innerText : "";
    const collapsed = raw
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return collapsed.length > MAX_PAGE_TEXT_LENGTH
      ? collapsed.slice(0, MAX_PAGE_TEXT_LENGTH)
      : collapsed;
  }

  // ---- Instagram-specific extraction ----
  // Instagram's DOM is unstable and unversioned; everything below is
  // best-effort and expected to need updates when Instagram changes its
  // markup. It only runs on instagram.com post/reel pages — every other
  // site falls back to the generic collectPageText() above.

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
    if (segments.length === 1 && !RESERVED_PATH_SEGMENTS.has(segments[0])) {
      return segments[0];
    }
    // Reels shown inline in a feed link to "/<user>/reels/" rather than
    // "/<user>/", since that tab is where the avatar/name click lands.
    if (segments.length === 2 && segments[1] === "reels" && !RESERVED_PATH_SEGMENTS.has(segments[0])) {
      return segments[0];
    }
    return undefined;
  }

  function firstValidUsername(anchors) {
    for (const anchor of anchors) {
      const username = usernameFromHref(anchor.getAttribute("href"));
      if (username) return username;
    }
    return undefined;
  }

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

  // Reels rendered inline in the feed (rather than opened on their own /p/
  // page) skip the comments panel entirely, so there is no <time> to anchor
  // on and no <h1>/<header> either. The caption is just the longest
  // dir="auto" span on the page outside of a <time> element — every other
  // span on a reel view (button labels, counters, timestamps) is short.
  function captionFromLongTextSpan() {
    const MIN_LENGTH = 40;
    let longest;
    for (const span of document.querySelectorAll("span[dir='auto']")) {
      if (span.closest("time")) continue;
      const value = text(span);
      if (value && value.length >= MIN_LENGTH && (!longest || value.length > longest.length)) {
        longest = value;
      }
    }
    return longest;
  }

  // Username: prefer the address bar (present whenever the post/reel was
  // reached from a profile link, and immune to markup churn), then the
  // caption entry's author link, then legacy header/h2 selectors. The old
  // "a.notranslate" selector matched the wrong person: Instagram also tags
  // the "Curtido por X" liker link as notranslate, and that link sits
  // earlier in the DOM than the author's.
  // Reels shown inline in the feed carry no <header>/<h2>; the owner's
  // avatar/name link is instead identified by an aria-label like "Vídeos
  // do Reels de <user>" (or the English "Reel videos by <user>").
  function usernameFromReelOwnerLink() {
    const anchors = document.querySelectorAll(
      "a[aria-label*='Reels de '], a[aria-label*='Reel videos by ']",
    );
    for (const anchor of anchors) {
      const fromHref = usernameFromHref(anchor.getAttribute("href"));
      if (fromHref) return fromHref;
      const label = anchor.getAttribute("aria-label") || "";
      const match = label.match(/Reels?(?: de| videos by) (.+)$/i);
      if (match) return match[1].trim();
    }
    return undefined;
  }

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

  function scrapeInstagramPost() {
    const isPostOrReelPage = /\/(p|reel|reels)\/[^/]+\/?/.test(window.location.pathname);
    if (!isPostOrReelPage) return undefined;

    const timeEls = Array.from(document.querySelectorAll("time[datetime]"));
    const captionTimeEl = timeEls.find((t) => !t.closest("a"));
    const captionEntry = captionTimeEl ? entryFromTime(captionTimeEl) : undefined;

    // Fallback for page variants where the time-based heuristic above doesn't
    // apply (older markup still using semantic tags).
    const legacyCaptionEl = document.querySelector(
      "h1, div[data-testid='post-caption'], ul li span",
    );

    const captionText = captionEntry?.body || text(legacyCaptionEl) || captionFromLongTextSpan();

    const profileUsername =
      usernameFromHref(window.location.pathname.split("/").slice(0, 2).join("/")) ||
      captionEntry?.username ||
      usernameFromReelOwnerLink() ||
      firstValidUsername(document.querySelectorAll("header a[href^='/']")) ||
      firstValidUsername(document.querySelectorAll("h2 a[href^='/']"));

    // The caption's own <time> is excluded here so it isn't double-counted
    // as an "author comment" below (its author is, by definition, the
    // profile owner).
    const commentEntries = timeEls
      .filter((t) => t !== captionTimeEl)
      .map(entryFromTime)
      .filter((entry) => entry?.body);

    const pinnedComments = commentEntries.filter((entry) => entry.isPinned);

    // Only the first 5 comments are checked for the author replying to
    // their own post — comments further down are too likely to be a
    // different user who merely mentions/tags the author.
    const authorCommentsInFirst5 = commentEntries
      .slice(0, 5)
      .filter((entry) => !!profileUsername && entry.username === profileUsername);

    const pinnedAuthorComments = [...new Set([...pinnedComments, ...authorCommentsInFirst5].map((entry) => entry.body))];

    const videoUrl = videoUrlFromEmbeddedJson() || videoUrlFromMeta() || videoUrlFromElement();

    return {
      captionText,
      pinnedAuthorComments,
      mentions: extractMentions(captionText),
      links: extractLinks(captionText),
      profileUsername,
      videoUrl,
    };
  }

  const isInstagram = window.location.hostname.includes("instagram.com");
  const instagramResult = isInstagram ? scrapeInstagramPost() : undefined;

  const base = {
    postUrl: window.location.href,
    pageText: collectPageText(),
  };

  // Instagram pages get the fully structured payload (plus pageText as a
  // supplementary fallback); every other site — Shopee, TikTok, a news
  // article, anything — gets whatever the browser can render as text, with
  // no site-specific parsing at all.
  return instagramResult
    ? { ...base, ...instagramResult }
    : { ...base, videoUrl: videoUrlFromMeta() || videoUrlFromElement() };
})();
