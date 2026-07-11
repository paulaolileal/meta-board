export const EXTENSION_IMPORT_STORAGE_KEY = "mb:ai-import";
export const EXTENSION_IMPORT_READY_EVENT = "mb:ai-import-ready";

export interface ExtensionImportPayload {
  captionText?: string;
  pinnedAuthorComments?: string[];
  mentions?: string[];
  links?: string[];
  profileUsername?: string;
  videoUrl?: string;
  postUrl?: string;
}

export function readPendingExtensionImport(): ExtensionImportPayload | null {
  const raw = sessionStorage.getItem(EXTENSION_IMPORT_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ExtensionImportPayload;
  } catch {
    return null;
  }
}

export function clearPendingExtensionImport(): void {
  sessionStorage.removeItem(EXTENSION_IMPORT_STORAGE_KEY);
}

export function formatExtensionImportAsText(payload: ExtensionImportPayload): string {
  return JSON.stringify(
    {
      "Author Username": payload.profileUsername,
      Caption: payload.captionText,
      "Tagged Users": payload.mentions,
      "Pinned Comments": payload.pinnedAuthorComments,
      Links: payload.links,
      "Post URL": payload.postUrl,
    },
    null,
    2,
  );
}
