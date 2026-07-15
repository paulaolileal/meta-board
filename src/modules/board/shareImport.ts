export const SHARE_IMPORT_STORAGE_KEY = "mb:share-import";
export const SHARE_IMPORT_READY_EVENT = "mb:share-import-ready";

export interface ShareImportPayload {
  title?: string;
  text?: string;
  url?: string;
}

export function readPendingShareImport(): ShareImportPayload | null {
  const raw = sessionStorage.getItem(SHARE_IMPORT_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ShareImportPayload;
  } catch {
    return null;
  }
}

export function clearPendingShareImport(): void {
  sessionStorage.removeItem(SHARE_IMPORT_STORAGE_KEY);
}

export function combineShareText(payload: ShareImportPayload): string {
  return [payload.title, payload.text, payload.url]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n");
}
