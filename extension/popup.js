const button = document.getElementById("capture");
const status = document.getElementById("status");

function setStatus(message, kind) {
  status.textContent = message;
  status.className = kind || "";
}

button.addEventListener("click", async () => {
  button.disabled = true;
  setStatus("Lendo a página...", "");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.startsWith("http")) {
      throw new Error("Abra uma página da web antes de clicar em enviar.");
    }

    const [{ result: payload }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["scraper.js"],
    });

    if (!payload) {
      throw new Error("Não consegui ler esta página. Tente abrir novamente.");
    }

    await chrome.runtime.sendMessage({ type: "IMPORT_PAYLOAD", payload });
    setStatus("Enviado! Abrindo o MetaBoard...", "success");
    setTimeout(() => window.close(), 600);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Algo deu errado. Tente novamente.", "error");
    button.disabled = false;
  }
});
