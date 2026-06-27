import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { getSheetProvider, isMockMode, envSpreadsheetId } from "@/shared/providers/providerFactory";
import { ENV_CONNECTION_ID } from "@/routes/HomePage";
import { useBoardStore } from "@/modules/board/store";
import { useSpreadsheetStore } from "@/modules/project/store/spreadsheetStore";
import type { CardRecord } from "@/modules/project/domain/types";
import { cacheSet } from "@/shared/cache/localCache";

const WRITE_DEBOUNCE_MS = 2000;
const MOCK_SHEET_ID = "mock";

export function useCardMutations() {
  const upsertCard = useBoardStore((s) => s.upsertCard);
  const removeCard = useBoardStore((s) => s.removeCard);
  const reorderCards = useBoardStore((s) => s.reorderCards);
  const connectionId = useBoardStore((s) => s.connectionId);
  const boardId = useBoardStore((s) => s.boardId);
  const connections = useSpreadsheetStore((s) => s.connections);
  const pending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const sheetId = useMemo(() => {
    if (isMockMode()) return MOCK_SHEET_ID;
    if (connectionId === ENV_CONNECTION_ID) return envSpreadsheetId ?? "";
    return connections.find((c) => c.id === connectionId)?.sheetId ?? "";
  }, [connectionId, connections]);

  const provider = useMemo(() => getSheetProvider(sheetId), [sheetId]);

  const cacheKey = `board:${connectionId}:${boardId}`;

  const flushPersist = useCallback(async () => {
    const { board, fields, cards } = useBoardStore.getState();
    if (board) await cacheSet(cacheKey, { board, fields, cards });
  }, [cacheKey]);

  const queueSave = useCallback(
    (card: CardRecord) => {
      const map = pending.current;
      const existing = map.get(card._id);
      if (existing) clearTimeout(existing);
      const t = setTimeout(async () => {
        try {
          await provider.saveCard(card);
          await flushPersist();
        } catch (e) {
          console.error(e);
          toast.error("Falha ao sincronizar card");
        } finally {
          map.delete(card._id);
        }
      }, WRITE_DEBOUNCE_MS);
      map.set(card._id, t);
    },
    [provider, flushPersist],
  );

  const updateCard = useCallback(
    (card: CardRecord) => {
      upsertCard(card);
      queueSave(card);
    },
    [upsertCard, queueSave],
  );

  const createCard = useCallback(
    async (partial: Partial<CardRecord>) => {
      if (!boardId) return;
      try {
        const c = await provider.createCard(boardId, partial);
        upsertCard(c);
        await flushPersist();
        toast.success("Card criado");
        return c;
      } catch (e) {
        console.error(e);
        toast.error("Falha ao criar card");
      }
    },
    [boardId, provider, upsertCard, flushPersist],
  );

  const deleteCard = useCallback(
    async (id: string) => {
      const prev = useBoardStore.getState().cards.find((c) => c._id === id);
      removeCard(id);
      try {
        await provider.deleteCard(id);
        await flushPersist();
        toast.success("Card removido", {
          action: prev
            ? {
                label: "Desfazer",
                onClick: async () => {
                  if (!boardId) return;
                  await provider.createCard(boardId, prev);
                  upsertCard(prev);
                  await flushPersist();
                },
              }
            : undefined,
        });
      } catch (e) {
        console.error(e);
        toast.error("Falha ao remover");
      }
    },
    [boardId, provider, removeCard, upsertCard, flushPersist],
  );

  const persistReorder = useCallback(
    (next: CardRecord[]) => {
      reorderCards(next);
      next.forEach((c) => queueSave(c));
    },
    [reorderCards, queueSave],
  );

  return { updateCard, createCard, deleteCard, persistReorder };
}
