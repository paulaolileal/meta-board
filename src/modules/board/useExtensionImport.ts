import { useEffect, useRef } from "react";

const STORAGE_KEY = "mb:ai-import";
const READY_EVENT = "mb:ai-import-ready";

interface ExtensionImportPayload {
  captionText?: string;
  pinnedAuthorComments?: string[];
  mentions?: string[];
  links?: string[];
  profileUsername?: string;
  videoUrl?: string;
  postUrl?: string;
}

function formatPayloadAsText(payload: ExtensionImportPayload): string {
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

export function useExtensionImport(onPayload: (text: string, videoUrl?: string) => void): void {
  const consumedRef = useRef(false);

  useEffect(() => {
    function consume() {
      if (consumedRef.current) return;
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      consumedRef.current = true;
      sessionStorage.removeItem(STORAGE_KEY);

      try {
        const payload = JSON.parse(raw) as ExtensionImportPayload;
        onPayload(formatPayloadAsText(payload), payload.videoUrl);
      } catch {
        // Malformed payload from the extension — silently ignore.
      }
    }

    consume();
    window.addEventListener(READY_EVENT, consume);
    return () => window.removeEventListener(READY_EVENT, consume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
