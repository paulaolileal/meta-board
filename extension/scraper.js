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

  // Instagram's DOM is unstable and unversioned; these selectors are best-effort
  // and expected to need updates when Instagram changes its markup.
  // Instagram no longer wraps post content in <article>/<header>, so we scope
  // to the whole document and gate on the URL instead.
  const isPostOrReelPage = /\/(p|reel|reels)\/[^/]+\/?/.test(window.location.pathname);
  if (!isPostOrReelPage) return null;

  const captionEl = document.querySelector("h1, div[data-testid='post-caption'], ul li span");
  const captionText = text(captionEl);

  // Instagram tags the author's profile link with "notranslate" so autotranslate
  // skips usernames; this has stayed stable across markup rewrites.
  const profileLinkEl = document.querySelector("a.notranslate[href^='/']");
  const profileUsername = profileLinkEl
    ? profileLinkEl.getAttribute("href")?.replace(/\//g, "")
    : undefined;

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

  const videoEl = document.querySelector("video");
  const videoUrl = videoEl ? videoEl.currentSrc || videoEl.src || undefined : undefined;

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
