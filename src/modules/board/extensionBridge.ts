import type { ExtensionImportPayload } from "@/modules/board/extensionImport";

// Bidirectional counterpart to extension/bridge-content-script.js — the app
// asks the extension to scrape a URL and awaits a correlated response via
// window.postMessage, the only channel a content script and the page share.
// See extension/bridge-content-script.js for the other half of this
// protocol and why each request/response pair carries a matching `id`.

const APP_SOURCE = "metaboard-app";
const EXTENSION_SOURCE = "metaboard-extension";

export type ExtensionScrapeErrorCode =
  | "TIMEOUT"
  | "LOGIN_REQUIRED"
  | "SCRIPT_ERROR"
  | "PERMISSION_DENIED"
  | "PERMISSION_ERROR"
  | "EXTENSION_ERROR";

export class ExtensionScrapeError extends Error {
  code: ExtensionScrapeErrorCode;

  constructor(code: ExtensionScrapeErrorCode, message: string) {
    super(message);
    this.name = "ExtensionScrapeError";
    this.code = code;
  }
}

interface PendingEntry {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

const pending = new Map<string, PendingEntry>();

// Set as soon as the bridge's initial "I'm here" ping is observed, so a
// later isExtensionAvailable() call can skip the round trip entirely.
let extensionSeen = false;

function handleExtensionMessage(event: MessageEvent) {
  if (event.source !== window || event.data?.source !== EXTENSION_SOURCE) return;
  const data = event.data as Record<string, unknown>;

  if (data.type === "MB_EXTENSION_READY") {
    extensionSeen = true;
    return;
  }

  const id = data.id as string | undefined;
  if (!id) return;
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);

  if (data.type === "MB_PONG") {
    entry.resolve(true);
    return;
  }

  if (data.type === "MB_SCRAPE_RESPONSE") {
    if (data.ok) {
      entry.resolve(data.payload as ExtensionImportPayload);
    } else {
      const error = data.error as { code: ExtensionScrapeErrorCode; message: string } | undefined;
      entry.reject(
        new ExtensionScrapeError(
          error?.code ?? "EXTENSION_ERROR",
          error?.message ?? "Unknown error",
        ),
      );
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("message", handleExtensionMessage);
}

function correlatedRequest<T>(post: (id: string) => void, timeoutMs: number): Promise<T> {
  const id = crypto.randomUUID();

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new ExtensionScrapeError("TIMEOUT", "Extension did not respond in time"));
    }, timeoutMs);

    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value as T);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });

    post(id);
  });
}

// Must stay above extension/background.js's own SCRAPE_OVERALL_TIMEOUT_MS
// (45s) — otherwise the app gives up and reports a timeout for a scrape
// that was still legitimately in progress on the extension side.
const SCRAPE_TIMEOUT_MS = 50000;

/** Asks the extension to open `url` in a background tab, scrape it, and
 * return the extracted payload — used by the batch pending-queue processor
 * to run the same extraction as the manual popup flow, one link at a time,
 * without the user opening each page themselves. */
export function requestExtensionScrape(
  url: string,
  timeoutMs = SCRAPE_TIMEOUT_MS,
): Promise<ExtensionImportPayload> {
  return correlatedRequest<ExtensionImportPayload>((id) => {
    window.postMessage(
      { source: APP_SOURCE, type: "MB_SCRAPE_REQUEST", id, url },
      window.location.origin,
    );
  }, timeoutMs);
}

/** Resolves `true` only if the MetaBoard Capture extension is installed and
 * its bridge content script responded — used to disable the batch-processing
 * button (with an explanatory message) rather than let every request in a
 * batch fail with a timeout. */
export async function isExtensionAvailable(pingTimeoutMs = 1500): Promise<boolean> {
  if (extensionSeen) return true;
  try {
    await correlatedRequest<boolean>((id) => {
      window.postMessage({ source: APP_SOURCE, type: "MB_PING", id }, window.location.origin);
    }, pingTimeoutMs);
    return true;
  } catch {
    return false;
  }
}
