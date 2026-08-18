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

const SCRAPE_READY_TIMEOUT_MS = 15000;
const SCRAPE_OVERALL_TIMEOUT_MS = 25000;

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
      const hasContentSignal =
        document.querySelector("meta[property='og:title']")?.getAttribute("content") ||
        document.querySelector("time[datetime]");
      if (document.readyState === "complete" && hasContentSignal) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= maxWaitMs) {
        resolve(false);
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

// The timeout below only races the *readiness* wait, not the whole function
// — it stays inside this same try/finally so chrome.tabs.remove() always
// runs once the function returns, whichever branch wins. Racing the tab's
// entire lifecycle from the outside (e.g. in the message listener) would let
// a losing race abandon the tab open, since its own cleanup would never get
// to run.
async function scrapeUrlInBackgroundTab(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  try {
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
