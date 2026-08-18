const APP_URL = "https://board.lealtek.com/boards";
const APP_ORIGIN = new URL(APP_URL).origin;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "IMPORT_PAYLOAD") return undefined;

  (async () => {
    await chrome.storage.local.set({ pendingImport: message.payload });

    const tabs = await chrome.tabs.query({});
    const existing = tabs.find((t) => t.url && t.url.startsWith(APP_ORIGIN));

    if (existing?.id) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId !== undefined) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
    } else {
      await chrome.tabs.create({ url: APP_URL });
    }

    sendResponse({ ok: true });
  })();

  return true;
});

// ---- Batch scrape (app-driven, one URL per call) ----
// Used by the "process pending queue" flow in the app: it calls this once
// per pending link, in sequence, via the bridge content script. Kept to a
// single URL per message (rather than looping a whole batch here) because a
// long-running loop inside this MV3 service worker risks being terminated
// mid-batch with no persisted progress — the app owns the loop, cancellation
// and progress UI; this only opens one background tab, scrapes it, and
// closes it.

const TAB_LOAD_TIMEOUT_MS = 20000;
const SCRAPE_READY_TIMEOUT_MS = 20000;
const SCRAPE_OVERALL_TIMEOUT_MS = 45000;

// chrome.tabs.create()'s promise resolves as soon as the tab exists, not
// once it has navigated to the requested URL — the tab briefly shows
// about:blank first. Injecting a script right after create() can land in
// that intermediate document; when the real navigation follows, that JS
// context is torn down and any pending work in it (including a Promise
// waitUntilReady() is still polling inside) never resolves, so every scrape
// silently timed out instead of running against the actual page. Waiting
// for chrome.tabs.onUpdated's "complete" status first ensures scripts are
// only injected into the final, navigated document.
function waitForTabLoad(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    function finish(loaded) {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve(loaded);
    }
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") finish(true);
    }
    chrome.tabs.onUpdated.addListener(listener);
    const timer = setTimeout(() => finish(false), timeoutMs);

    // Covers the case where the tab already finished loading (e.g. an
    // instant/cached navigation) before this listener got attached.
    chrome.tabs.get(tabId, (tab) => {
      if (tab?.status === "complete") finish(true);
    });
  });
}

// Injected into the target tab. Polls internally (a single executeScript
// call awaiting its own loop) instead of the service worker re-injecting a
// check on every tick — document.readyState alone fires well before a
// heavy SPA like Instagram has hydrated its content into the DOM.
function waitUntilReady(maxWaitMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      if (location.pathname.startsWith("/accounts/login")) {
        resolve("login_required");
        return;
      }
      // Any of these means the SPA has hydrated real content, not just the
      // initial HTML shell. Several alternatives are accepted (not just
      // og:title/time) because a background tab may be exactly the case
      // Instagram's own performance optimizations (Page Visibility-based
      // lazy hydration) delay the most — the goal here is "enough to hand
      // off to scraper.js", not a guarantee every field will be present.
      const hasContentSignal =
        document.querySelector("meta[property='og:title']")?.getAttribute("content") ||
        document.querySelector("time[datetime]") ||
        document.querySelector("article") ||
        document.querySelector("video");
      const elapsed = Date.now() - start;
      if (document.readyState === "complete" && hasContentSignal) {
        resolve(true);
        return;
      }
      if (elapsed >= maxWaitMs) {
        // Out of budget: still hand off to scraper.js if the document at
        // least finished loading, instead of failing outright — its own
        // per-content-type extraction already degrades gracefully when a
        // specific element isn't there yet.
        resolve(document.readyState === "complete");
        return;
      }
      setTimeout(check, 250);
    }
    check();
  });
}

function withTimeout(promise, ms, fallbackValue) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), ms)),
  ]);
}

// The timeouts below only race their own step, not the whole function — they
// stay inside this same try/finally so chrome.tabs.remove() always runs once
// the function returns, whichever branch wins. Racing the tab's entire
// lifecycle from the outside (e.g. in the message listener) would let a
// losing race abandon the tab open, since its own cleanup would never get to
// run.
async function scrapeUrlInBackgroundTab(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    const loaded = await waitForTabLoad(tab.id, TAB_LOAD_TIMEOUT_MS);
    if (!loaded) {
      return {
        ok: false,
        error: { code: "TIMEOUT", message: "Tab did not finish loading in time" },
      };
    }

    const readiness = await withTimeout(
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: waitUntilReady,
          args: [SCRAPE_READY_TIMEOUT_MS],
        })
        .then(([{ result }]) => result),
      SCRAPE_READY_TIMEOUT_MS + 2000,
      false,
    );

    if (readiness === "login_required") {
      return { ok: false, error: { code: "LOGIN_REQUIRED", message: "Login required on page" } };
    }
    if (readiness !== true) {
      return {
        ok: false,
        error: { code: "TIMEOUT", message: "Page did not become ready in time" },
      };
    }

    const [{ result: payload }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["scraper.js"],
    });

    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: { code: "SCRIPT_ERROR", message: String(e?.message || e) } };
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => undefined);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SCRAPE_URL") return undefined;

  (async () => {
    const result = await withTimeout(
      scrapeUrlInBackgroundTab(message.url),
      SCRAPE_OVERALL_TIMEOUT_MS,
      {
        ok: false,
        error: { code: "TIMEOUT", message: "Scrape timed out" },
      },
    );
    sendResponse(result);
  })();

  return true;
});
