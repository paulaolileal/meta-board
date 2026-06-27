import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { getSheetProvider } from "@/shared/providers/providerFactory";
import { useBoardStore } from "@/modules/board/store";
import type { CardRecord } from "@/modules/project/domain/types";
import { cacheSet } from "@/shared/cache/localCache";

const WRITE_DEBOUNCE_MS = 2000;

/**
 * Optimistic update + debounced background save.
 */
export function useCardMutations() {
  const upsertCard = useBoardStore((s) => s.upsertCard);
  const removeCard = useBoardStore((s) => s.removeCard);
  const reorderCards = useBoardStore((s) => s.reorderCards);
  const pending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const flushPersist = useCallback(async () => {
    const { project, fields, cards } = useBoardStore.getState();
    if (project) await cacheSet("board", { project, fields, cards });
  }, []);

  const queueSave = useCallback(
    (card: CardRecord) => {
      const map = pending.current;
      const existing = map.get(card._id);
      if (existing) clearTimeout(existing);
      const t = setTimeout(async () => {
        try {
          await getSheetProvider().saveCard(card);
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
    [flushPersist]
  );

  const updateCard = useCallback(
    (card: CardRecord) => {
      upsertCard(card);
      queueSave(card);
    },
    [upsertCard, queueSave]
  );

  const createCard = useCallback(
    async (partial: Partial<CardRecord>) => {
      try {
        const c = await getSheetProvider().createCard(partial);
        upsertCard(c);
        await flushPersist();
        toast.success("Card criado");
        return c;
      } catch (e) {
        console.error(e);
        toast.error("Falha ao criar card");
      }
    },
    [upsertCard, flushPersist]
  );

  const deleteCard = useCallback(
    async (id: string) => {
      const prev = useBoardStore.getState().cards.find((c) => c._id === id);
      removeCard(id);
      try {
        await getSheetProvider().deleteCard(id);
        await flushPersist();
        toast.success("Card removido", {
          action: prev
            ? {
                label: "Desfazer",
                onClick: async () => {
                  await getSheetProvider().createCard(prev);
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
    [removeCard, upsertCard, flushPersist]
  );

  const persistReorder = useCallback(
    (next: CardRecord[]) => {
      reorderCards(next);
      // Persist each modified card on debounce
      next.forEach((c) => queueSave(c));
    },
    [reorderCards, queueSave]
  );

  return { updateCard, createCard, deleteCard, persistReorder };
}
