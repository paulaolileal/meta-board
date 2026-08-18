import { useCallback, useRef, useState } from "react";
import { useBoardStore } from "@/modules/board/store";
import { usePendingMutations } from "@/modules/board/usePendingMutations";
import { useCardMutations } from "@/modules/board/useCardMutations";
import { useAiCardExtraction } from "@/modules/board/useAiCardExtraction";
import { requestExtensionScrape } from "@/modules/board/extensionBridge";
import { formatExtensionImportAsText } from "@/modules/board/extensionImport";
import { extractUrlFromPendingItem } from "@/modules/board/pendingUrl";
import type { PendingItem } from "@/modules/project/domain/types";

// Sequential, not parallel: these tabs share the user's own Instagram
// session cookies, so hammering it with concurrent requests risks flagging
// their account, not just failing the scrape. The randomized delay between
// items is the same mitigation, and MAX_CONSECUTIVE_FAILURES auto-stops the
// batch on the assumption that repeated failures mean Instagram started
// blocking rather than that each individual link happens to be broken.
const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 6000;
const MAX_CONSECUTIVE_FAILURES = 3;

export type BatchItemStatus = "success" | "error";

export interface BatchItemResult {
  item: PendingItem;
  status: BatchItemStatus;
  cardsCreated: number;
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
 * AiCardModal flow, creates the resulting card(s) flagged as `_autoCreated`,
 * and removes the pending item once its card(s) exist. One failure never
 * aborts the whole batch — it's recorded and the loop moves on — except when
 * failures start repeating, which auto-stops the batch instead of grinding
 * through a queue that's clearly not going to succeed. */
export function useBatchPendingProcessor() {
  const pendingItems = useBoardStore((s) => s.pendingItems);
  const { deletePendingItem } = usePendingMutations();
  const { createCard } = useCardMutations();
  const { extractFromText } = useAiCardExtraction();

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

          let cardsCreated = 0;
          for (const result of extracted) {
            const card = await createCard({ ...result.values, _autoCreated: true });
            if (card) cardsCreated++;
          }
          if (cardsCreated === 0) {
            throw new Error("Nenhum card foi criado a partir do conteúdo extraído");
          }

          await deletePendingItem(item._id);
          setResults((prev) => [...prev, { item, status: "success", cardsCreated }]);
          consecutiveFailures = 0;
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          setResults((prev) => [...prev, { item, status: "error", cardsCreated: 0, reason }]);
          consecutiveFailures++;

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            setStatus("stopped");
            setStopReason(
              `Interrompido após ${MAX_CONSECUTIVE_FAILURES} falhas seguidas — o Instagram pode estar bloqueando o acesso.`,
            );
            return;
          }
        }

        if (i < queue.length - 1 && !cancelRef.current) {
          await sleep(randomDelay());
        }
      }

      setStatus("done");
    },
    [pendingItems, createCard, deletePendingItem, extractFromText],
  );

  return { status, progress, results, stopReason, start, cancel };
}
