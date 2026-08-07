import { googleAuthService } from "@/shared/providers/providerFactory";
import { googleApiFetch } from "@/shared/api/googleApiFetch";

interface LinkPreviewResult {
  image: string | null;
  title?: string | null;
}

const previewCache = new Map<string, Promise<LinkPreviewResult>>();

async function fetchLinkPreview(url: string): Promise<LinkPreviewResult> {
  const response = await googleApiFetch(
    googleAuthService,
    `/api/link/preview?url=${encodeURIComponent(url)}`,
  );

  if (!response.ok) {
    return { image: null };
  }

  return (await response.json()) as LinkPreviewResult;
}

export function getLinkPreviewImage(url: string): Promise<string | null> {
  let pending = previewCache.get(url);
  if (!pending) {
    pending = fetchLinkPreview(url).catch(() => ({ image: null }) as LinkPreviewResult);
    previewCache.set(url, pending);
  }
  return pending.then((result) => result.image ?? null);
}
