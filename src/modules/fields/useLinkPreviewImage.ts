import { useEffect, useState } from "react";
import { getLinkPreviewImage } from "@/shared/api/LinkPreviewClient";

export function useLinkPreviewImage(url: string | undefined, enabled: boolean): string | null {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !url) {
      setImage(null);
      return;
    }
    let cancelled = false;
    getLinkPreviewImage(url).then((result) => {
      if (!cancelled) setImage(result);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, url]);

  return image;
}
