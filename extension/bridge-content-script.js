(function bridgeExtensionPayload() {
  async function consumePending() {
    const { pendingImport } = await chrome.storage.local.get("pendingImport");
    if (!pendingImport) return;

    await chrome.storage.local.remove("pendingImport");
    sessionStorage.setItem("mb:ai-import", JSON.stringify(pendingImport));
    window.dispatchEvent(new Event("mb:ai-import-ready"));
  }

  consumePending();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.pendingImport) consumePending();
  });

  // ---- Bidirectional request/response channel (app -> extension) ----
  // Used by the batch pending-queue processor to ask this bridge to scrape a
  // URL and await a correlated response. window.postMessage is the only
  // channel a content script and the page share (separate JS "worlds", same
  // document), so every message carries a `source` tag to ignore anything
  // not meant for this protocol, and requests carry an `id` so a response
  // can be matched back to its call when several run in sequence.

  const APP_SOURCE = "metaboard-app";
  const EXTENSION_SOURCE = "metaboard-extension";
  const SCRAPE_PERMISSION_ORIGINS = ["https://www.instagram.com/*"];

  function respond(id, body) {
    window.postMessage(
      { source: EXTENSION_SOURCE, type: "MB_SCRAPE_RESPONSE", id, ...body },
      window.location.origin,
    );
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== APP_SOURCE) return;
    const { type, id, url } = event.data;

    if (type === "MB_PING") {
      window.postMessage({ source: EXTENSION_SOURCE, type: "MB_PONG", id }, window.location.origin);
      return;
    }

    if (type !== "MB_SCRAPE_REQUEST") return;

    (async () => {
      // chrome.permissions.request() only succeeds inside a user-gesture
      // call stack. This listener fires from a same-document postMessage
      // sent synchronously from the "process pending" button's click
      // handler — the closest a content script can stay to that gesture.
      // Routing the request through the background service worker first
      // would lose it, so the permission check/request happens right here.
      try {
        const hasPermission = await chrome.permissions.contains({
          origins: SCRAPE_PERMISSION_ORIGINS,
        });
        if (!hasPermission) {
          const granted = await chrome.permissions.request({ origins: SCRAPE_PERMISSION_ORIGINS });
          if (!granted) {
            respond(id, {
              ok: false,
              error: { code: "PERMISSION_DENIED", message: "Instagram access not granted" },
            });
            return;
          }
        }
      } catch (e) {
        respond(id, {
          ok: false,
          error: { code: "PERMISSION_ERROR", message: String(e?.message || e) },
        });
        return;
      }

      chrome.runtime.sendMessage({ type: "SCRAPE_URL", url }, (result) => {
        if (chrome.runtime.lastError) {
          respond(id, {
            ok: false,
            error: { code: "EXTENSION_ERROR", message: chrome.runtime.lastError.message },
          });
          return;
        }
        respond(id, result);
      });
    })();
  });

  // Lets the app detect the extension is installed without a round trip:
  // posted once on load, and also answered on-demand via MB_PING above for
  // listeners that attach after this script already ran.
  window.postMessage(
    { source: EXTENSION_SOURCE, type: "MB_EXTENSION_READY" },
    window.location.origin,
  );
})();
