(async function scrapePage() {
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

  function videoUrlFromElement(root = document) {
    const videoEl = root.querySelector("video");
    const src = videoEl ? videoEl.currentSrc || videoEl.src : undefined;
    return src && !src.startsWith("blob:") ? src : undefined;
  }

  // Site-agnostic fallback: `innerText` follows the browser's own "rendered
  // text" algorithm, which already skips <script>/<style>/display:none
  // content — so this needs no per-site parsing to be useful on any page
  // (product listings, articles, tweets, whatever the user is looking at).
  // `root` narrows this to a single post's container on sites (Instagram)
  // where multiple unrelated posts sit mounted in the DOM at once.
  function collectPageText(root = document.body) {
    const raw = root ? root.innerText : "";
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
    if (
      segments.length === 2 &&
      segments[1] === "reels" &&
      !RESERVED_PATH_SEGMENTS.has(segments[0])
    ) {
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

  function isPostPermalinkAnchor(anchor) {
    return /^\/(?:p|reel|reels)\/[^/]+\/?$/.test(anchor.pathname);
  }

  function currentPostShortcode() {
    const match = window.location.pathname.match(/^\/(?:p|reel|reels)\/([^/]+)/);
    return match ? match[1] : undefined;
  }

  // The Reels feed (`/reels/`) — unlike a single-post `/p/` page — keeps
  // every post the user has scrolled past mounted in the DOM at once,
  // stacked as siblings. Any document-wide query on that page bleeds in
  // captions/comments/video from posts the user never opened. This starts
  // at the open post's own permalink anchor and walks up only as long as
  // the subtree still refers to that one shortcode, stopping the instant a
  // parent would start covering a second post — landing on the largest
  // container that is still exclusively about the open post.
  function activePostContainer() {
    const shortcode = currentPostShortcode();
    if (!shortcode) return document.body;

    const permalinkAnchors = Array.from(document.querySelectorAll("a[href]")).filter(
      isPostPermalinkAnchor,
    );
    const shortcodeOf = (anchor) => anchor.pathname.split("/").filter(Boolean)[1];
    const ownAnchor = permalinkAnchors.find((anchor) => shortcodeOf(anchor) === shortcode);
    if (!ownAnchor) return document.body;

    let container = ownAnchor;
    let candidate = ownAnchor.parentElement;
    while (candidate && candidate !== document.body) {
      const shortcodesInside = new Set(
        permalinkAnchors.filter((anchor) => candidate.contains(anchor)).map(shortcodeOf),
      );
      if (shortcodesInside.size > 1) break;
      container = candidate;
      candidate = candidate.parentElement;
    }
    return container;
  }

  // Instagram has also dropped <h1>/<h2>/<ul>/<li> from the post/comments
  // panel, so tag-based selectors can no longer find the caption or its
  // author. <time datetime> is the one semantic element Instagram keeps for
  // accessibility, and it encodes a structural fact that survives markup
  // churn: every real comment's timestamp sits inside a permalink link
  // (a[href*="/c/"]), while the caption's timestamp — rendered as the
  // list's first entry — is not wrapped in any link at all.
  function containerWithAuthorLink(timeEl, root = document.body) {
    let node = timeEl.parentElement;
    while (node && node !== document.body) {
      const username = firstValidUsername(node.querySelectorAll("a[href^='/']"));
      if (username) return { container: node, username };
      // Never walk past the active post's own container — beyond it lies
      // shared feed markup that other stacked reels also match against.
      if (node === root) break;
      node = node.parentElement;
    }
    return undefined;
  }

  function entryFromTime(timeEl, root) {
    const found = containerWithAuthorLink(timeEl, root);
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
  function captionFromLongTextSpan(root = document) {
    const MIN_LENGTH = 40;
    let longest;
    for (const span of root.querySelectorAll("span[dir='auto']")) {
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
  function usernameFromReelOwnerLink(root = document) {
    const anchors = root.querySelectorAll(
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

  // Long captions/comments are rendered truncated behind a "… mais"/"… more"
  // toggle. Its visible label sits in an aria-hidden span right next to the
  // truncated text, and — critically — that truncated span lacks the
  // dir="auto" attribute the rest of this scraper relies on to find text (only
  // its parent div has it), so without expanding it first, captionText (and
  // everything derived from it, like @mentions) silently comes back partial.
  const EXPAND_LABEL_PATTERN = /^(?:\.{3}|…)?\s*(mais|more|m[áa]s)$/i;

  function expandTruncatedText(root = document) {
    let expanded = false;
    for (const span of root.querySelectorAll("span[aria-hidden='true']")) {
      const label = (span.textContent || "").trim();
      if (!EXPAND_LABEL_PATTERN.test(label)) continue;
      const trigger = span.closest("[role='button']");
      if (trigger) {
        trigger.click();
        expanded = true;
      }
    }
    return expanded;
  }

  function waitForNextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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

  async function scrapeInstagramPost(root) {
    const isPostOrReelPage = /\/(p|reel|reels)\/[^/]+\/?/.test(window.location.pathname);
    if (!isPostOrReelPage) return undefined;

    if (expandTruncatedText(root)) {
      await waitForNextPaint();
    }

    const timeEls = Array.from(root.querySelectorAll("time[datetime]"));
    const captionTimeEl = timeEls.find((t) => !t.closest("a"));
    const captionEntry = captionTimeEl ? entryFromTime(captionTimeEl, root) : undefined;

    // Fallback for page variants where the time-based heuristic above doesn't
    // apply (older markup still using semantic tags).
    const legacyCaptionEl = root.querySelector(
      "h1, div[data-testid='post-caption'], ul li span",
    );

    const captionText =
      captionEntry?.body || text(legacyCaptionEl) || captionFromLongTextSpan(root);

    const profileUsername =
      usernameFromHref(window.location.pathname.split("/").slice(0, 2).join("/")) ||
      captionEntry?.username ||
      usernameFromReelOwnerLink(root) ||
      firstValidUsername(root.querySelectorAll("header a[href^='/']")) ||
      firstValidUsername(root.querySelectorAll("h2 a[href^='/']"));

    // The caption's own <time> is excluded here so it isn't double-counted
    // as an "author comment" below (its author is, by definition, the
    // profile owner).
    const commentEntries = timeEls
      .filter((t) => t !== captionTimeEl)
      .map((t) => entryFromTime(t, root))
      .filter((entry) => entry?.body);

    const pinnedComments = commentEntries.filter((entry) => entry.isPinned);

    // Only the first 5 comments are checked for the author replying to
    // their own post — comments further down are too likely to be a
    // different user who merely mentions/tags the author.
    const authorCommentsInFirst5 = commentEntries
      .slice(0, 5)
      .filter((entry) => !!profileUsername && entry.username === profileUsername);

    const pinnedAuthorComments = [
      ...new Set([...pinnedComments, ...authorCommentsInFirst5].map((entry) => entry.body)),
    ];

    const videoUrl = videoUrlFromEmbeddedJson() || videoUrlFromMeta() || videoUrlFromElement(root);

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
  // Computed once and shared: on the Reels feed this is the open post's own
  // container (see activePostContainer), keeping both the structured fields
  // below and the "extra" catch-all scoped to the same single post.
  const instagramRoot = isInstagram ? activePostContainer() : undefined;
  const instagramResult = isInstagram ? await scrapeInstagramPost(instagramRoot) : undefined;

  const base = {
    postUrl: window.location.href,
    // Always included, alongside whatever structured fields were parsed
    // above — a catch-all so any visible text the site-specific extraction
    // doesn't categorize (captions included) is never silently lost.
    extra: collectPageText(instagramRoot),
  };

  // Instagram pages get the fully structured payload on top of the extra
  // catch-all; every other site — Shopee, TikTok, a news article, anything —
  // gets only the catch-all, with no site-specific parsing at all.
  return instagramResult
    ? { ...base, ...instagramResult }
    : { ...base, videoUrl: videoUrlFromMeta() || videoUrlFromElement() };
})();
