import { useCallback } from "react";
import { toast } from "sonner";
import { getSheetProvider } from "@/shared/providers/providerFactory";
import { useBoardStore } from "@/modules/board/store";
import { cacheSet } from "@/shared/cache/localCache";

export function usePendingMutations() {
  const upsertPendingItem = useBoardStore((s) => s.upsertPendingItem);
  const removePendingItem = useBoardStore((s) => s.removePendingItem);
  const setPendingItems = useBoardStore((s) => s.setPendingItems);
  const boardId = useBoardStore((s) => s.boardId);

  const provider = getSheetProvider();
  const cacheKey = `board:${boardId}`;

  const flushPersist = useCallback(async () => {
    const { board, fields, cards, pendingItems } = useBoardStore.getState();
    if (board) await cacheSet(cacheKey, { board, fields, cards, pendingItems });
  }, [cacheKey]);

  const createPendingItem = useCallback(
    async (description: string) => {
      if (!boardId) return;
      try {
        const item = await provider.createPendingItem(boardId, description);
        upsertPendingItem(item);
        await flushPersist();
        toast.success("Adicionado à lista de pendentes");
        return item;
      } catch (e) {
        console.error(e);
        toast.error("Falha ao adicionar pendente");
      }
    },
    [boardId, provider, upsertPendingItem, flushPersist],
  );

  const toggleDone = useCallback(
    async (id: string, done: boolean) => {
      const prev = useBoardStore.getState().pendingItems.find((p) => p._id === id);
      if (!prev) return;
      upsertPendingItem({ ...prev, _done: done });
      try {
        await provider.togglePendingItemDone(id, done);
        await flushPersist();
      } catch (e) {
        console.error(e);
        upsertPendingItem(prev);
        toast.error("Falha ao atualizar pendente");
      }
    },
    [provider, upsertPendingItem, flushPersist],
  );

  const deletePendingItem = useCallback(
    async (id: string) => {
      const prev = useBoardStore.getState().pendingItems.find((p) => p._id === id);
      removePendingItem(id);
      try {
        await provider.deletePendingItem(id);
        await flushPersist();
      } catch (e) {
        console.error(e);
        if (prev) upsertPendingItem(prev);
        toast.error("Falha ao remover pendente");
      }
    },
    [provider, removePendingItem, upsertPendingItem, flushPersist],
  );

  const clearCompleted = useCallback(async () => {
    if (!boardId) return;
    const prev = useBoardStore.getState().pendingItems;
    setPendingItems(prev.filter((p) => !p._done));
    try {
      await provider.clearCompletedPendingItems(boardId);
      await flushPersist();
    } catch (e) {
      console.error(e);
      setPendingItems(prev);
      toast.error("Falha ao limpar concluídos");
    }
  }, [boardId, provider, setPendingItems, flushPersist]);

  return { createPendingItem, toggleDone, deletePendingItem, clearCompleted };
}
