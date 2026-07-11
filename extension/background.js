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
