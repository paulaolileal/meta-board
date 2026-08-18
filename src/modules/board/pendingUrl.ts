import type { PendingItem } from "@/modules/project/domain/types";

const URL_PATTERN = /(https?:\/\/[^\s]+)/;

/** Pending items store a free-text description (see PendingItem) — this
 * pulls out the first URL in it, used both to render an "Abrir link" link
 * and, for the batch processor, to know which items have something the
 * extension can actually scrape. */
export function extractUrlFromPendingItem(item: PendingItem): string | undefined {
  return item.description.match(URL_PATTERN)?.[0];
}
