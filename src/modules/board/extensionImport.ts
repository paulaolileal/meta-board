export const EXTENSION_IMPORT_STORAGE_KEY = "mb:ai-import";
export const EXTENSION_IMPORT_READY_EVENT = "mb:ai-import-ready";

export type InstagramPostType = "post" | "reel" | "tv";

export interface InstagramMediaItem {
  type: "image" | "video";
  url: string;
}

export interface ExtensionImportPayload {
  captionText?: string;
  pinnedAuthorComments?: string[];
  mentions?: string[];
  links?: string[];
  profileUsername?: string;
  videoUrl?: string;
  postUrl?: string;
  /** Instagram content type detected from the URL — absent on non-Instagram
   * pages, where there's no dedicated extraction to distinguish. */
  postType?: InstagramPostType;
  /** Ordered carousel media (post type only); a single-item array for a
   * non-carousel post with one photo/video. */
  media?: InstagramMediaItem[];
  /** Raw, unparsed text collected from the page. Always present as a
   * catch-all for anything the site-specific extraction above doesn't
   * categorize — the sole source of content on sites without dedicated
   * extraction, like Shopee or TikTok. */
  extra?: string;
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
  const authorProfileUrl = payload.profileUsername
    ? `https://www.instagram.com/${payload.profileUsername}/`
    : undefined;

  return JSON.stringify(
    {
      "Author Username": authorProfileUrl,
      "Post Type": payload.postType,
      Caption: payload.captionText,
      "Tagged Users": payload.mentions,
      "Pinned Comments": payload.pinnedAuthorComments,
      Links: payload.links,
      Media: payload.media,
      "Post URL": payload.postUrl,
      extra: payload.extra,
    },
    null,
    2,
  );
}
