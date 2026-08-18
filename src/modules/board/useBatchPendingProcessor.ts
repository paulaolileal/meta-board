import { useCallback, useRef, useState } from "react";
import { useBoardStore } from "@/modules/board/store";
import { usePendingMutations } from "@/modules/board/usePendingMutations";
import { useCardMutations } from "@/modules/board/useCardMutations";
import { IrrelevantContentError, useAiCardExtraction } from "@/modules/board/useAiCardExtraction";
import { ExtensionScrapeError, requestExtensionScrape } from "@/modules/board/extensionBridge";
import { formatExtensionImportAsText } from "@/modules/board/extensionImport";
import { extractUrlFromPendingItem } from "@/modules/board/pendingUrl";
import type { CardRecord, PendingItem } from "@/modules/project/domain/types";

// Sequential, not parallel: these tabs share the user's own Instagram
// session cookies, so hammering it with concurrent requests risks flagging
// their account, not just failing the scrape. The randomized delay between
// items is the same mitigation, and MAX_CONSECUTIVE_FAILURES auto-stops the
// batch on the assumption that repeated failures mean Instagram started
// blocking rather than that each individual link happens to be broken.
const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 6000;
const MAX_CONSECUTIVE_FAILURES = 3;

export type BatchItemStatus = "success" | "error" | "rejected";

export interface BatchItemResult {
  item: PendingItem;
  status: BatchItemStatus;
  /** The card(s) actually created for this item. Empty for "error" and
   * "rejected" results. */
  cards: CardRecord[];
  reason?: string;
}

export type BatchProcessorStatus = "idle" | "running" | "stopped" | "done";

function randomDelay(): number {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Drives the "process pending queue automatically" flow: for each pending
 * item with an extractable URL, asks the extension to scrape it
 * (extensionBridge), runs the same AI field extraction as the manual
 * AiCardModal flow, then tries to complete the card via the same web-search
 * enrichment step the modal's "buscar" button uses — filling fields the
 * extraction missed and re-checking any field it extracted with low
 * confidence, without ever touching a field it's already confident about
 * (see LOW_CONFIDENCE_THRESHOLD in useAiCardExtraction.ts). Creates the
 * resulting card(s) flagged as `_autoCreated`, and removes the pending item
 * once its card(s) exist. If the extraction step judges the source content
 * unrelated to the board's subject (see IrrelevantContentError), the item is
 * marked "rejected" instead of "error" and left in the pending queue for
 * manual handling — this doesn't count toward MAX_CONSECUTIVE_FAILURES since
 * it isn't a sign that Instagram/the extension is failing. One failure never
 * aborts the whole batch — it's recorded and the loop moves on — except when
 * failures start repeating, which auto-stops the batch instead of grinding
 * through a queue that's clearly not going to succeed. */
export function useBatchPendingProcessor() {
  const pendingItems = useBoardStore((s) => s.pendingItems);
  const { deletePendingItem } = usePendingMutations();
  const { createCard } = useCardMutations();
  const { extractFromText, enrichMissingFields } = useAiCardExtraction();

  const [status, setStatus] = useState<BatchProcessorStatus>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<BatchItemResult[]>([]);
  const [stopReason, setStopReason] = useState<string | undefined>();

  const cancelRef = useRef(false);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const start = useCallback(
    async (itemIds?: string[]) => {
      const idFilter = itemIds ? new Set(itemIds) : undefined;
      const queue = pendingItems.filter(
        (item) =>
          !item._done && extractUrlFromPendingItem(item) && (!idFilter || idFilter.has(item._id)),
      );
      if (queue.length === 0) return;

      cancelRef.current = false;
      setStatus("running");
      setResults([]);
      setStopReason(undefined);
      setProgress({ current: 0, total: queue.length });

      let consecutiveFailures = 0;

      for (let i = 0; i < queue.length; i++) {
        if (cancelRef.current) {
          setStatus("stopped");
          setStopReason("Cancelado pelo usuário");
          return;
        }

        const item = queue[i];
        setProgress({ current: i + 1, total: queue.length });
        const url = extractUrlFromPendingItem(item)!;

        try {
          const payload = await requestExtensionScrape(url);
          const text = formatExtensionImportAsText(payload);
          const extracted = await extractFromText(text);
          const enriched = await enrichMissingFields(extracted);

          const createdCards: CardRecord[] = [];
          for (const result of enriched) {
            const card = await createCard({ ...result.values, _autoCreated: true });
            if (card) createdCards.push(card);
          }
          if (createdCards.length === 0) {
            throw new Error("Nenhum card foi criado a partir do conteúdo extraído");
          }

          await deletePendingItem(item._id);
          setResults((prev) => [...prev, { item, status: "success", cards: createdCards }]);
          consecutiveFailures = 0;
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);

          if (e instanceof IrrelevantContentError) {
            // A content/board mismatch is a legitimate signal from the
            // extraction step, not a sign that Instagram or the extension is
            // failing — record it as a rejection (item stays pending for
            // manual routing) without touching the failure-streak counter.
            setResults((prev) => [...prev, { item, status: "rejected", cards: [], reason }]);
          } else {
            setResults((prev) => [...prev, { item, status: "error", cards: [], reason }]);

            // The extension was reloaded/updated mid-batch — every remaining
            // item would fail the exact same way until the page itself
            // reloads to get a fresh content script, so there's no point
            // waiting for MAX_CONSECUTIVE_FAILURES to give up.
            if (e instanceof ExtensionScrapeError && e.code === "EXTENSION_CONTEXT_INVALIDATED") {
              setStatus("stopped");
              setStopReason(
                "A extensão foi atualizada durante o processamento — recarregue a página do MetaBoard e tente novamente.",
              );
              return;
            }

            consecutiveFailures++;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              setStatus("stopped");
              setStopReason(
                `Interrompido após ${MAX_CONSECUTIVE_FAILURES} falhas seguidas — o Instagram pode estar bloqueando o acesso.`,
              );
              return;
            }
          }
        }

        if (i < queue.length - 1 && !cancelRef.current) {
          await sleep(randomDelay());
        }
      }

      setStatus("done");
    },
    [pendingItems, createCard, deletePendingItem, extractFromText, enrichMissingFields],
  );

  return { status, progress, results, stopReason, start, cancel };
}
