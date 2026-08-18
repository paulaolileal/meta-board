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
      // chrome.runtime.id reads back undefined (without throwing) once this
      // content script's connection to the extension is invalidated — e.g.
      // the extension was reloaded/updated after this script was injected
      // into an already-open tab. Staying silent here (instead of ponging)
      // lets the app's own ping timeout correctly report "not available"
      // rather than a stale "yes" from before the reload.
      if (chrome.runtime?.id) {
        window.postMessage(
          { source: EXTENSION_SOURCE, type: "MB_PONG", id },
          window.location.origin,
        );
      }
      return;
    }

    if (type !== "MB_SCRAPE_REQUEST") return;

    // Host permission for Instagram is granted statically at install time
    // (manifest.json's host_permissions), not requested here at runtime —
    // chrome.permissions isn't available to content scripts at all (only to
    // extension pages/the background service worker), so there is no way to
    // check or request it from this file.
    try {
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
    } catch (e) {
      // Thrown synchronously (chrome.runtime becomes undefined) when the
      // extension was reloaded/updated after this content script was
      // injected into the page — every content script already running in
      // an open tab loses its connection to the extension at that point.
      // There's no way to recover from inside this script; the page itself
      // needs a reload to get a fresh one.
      respond(id, {
        ok: false,
        error: {
          code: "EXTENSION_CONTEXT_INVALIDATED",
          message: String(e?.message || e),
        },
      });
    }
  });

  // Lets the app detect the extension is installed without a round trip:
  // posted once on load, and also answered on-demand via MB_PING above for
  // listeners that attach after this script already ran.
  window.postMessage(
    { source: EXTENSION_SOURCE, type: "MB_EXTENSION_READY" },
    window.location.origin,
  );
})();
