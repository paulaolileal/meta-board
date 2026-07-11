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
})();
