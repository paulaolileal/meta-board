import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSheetProvider } from "@/shared/providers/providerFactory";
import { useBoardStore } from "@/modules/board/store";
import { cacheGet, cacheSet } from "@/shared/cache/localCache";
import type {
  BoardConfig,
  CardRecord,
  FieldDef,
  PendingItem,
} from "@/modules/project/domain/types";

export function useBoardData(boardId: string) {
  const setAll = useBoardStore((s) => s.setAll);
  const cacheKey = `board:${boardId}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await cacheGet<{
        board: unknown;
        fields: unknown;
        cards: unknown;
        pendingItems?: unknown;
      }>(cacheKey);
      if (cached && !cancelled) {
        setAll(
          cached.board as BoardConfig,
          cached.fields as FieldDef[],
          cached.cards as CardRecord[],
          boardId,
          (cached.pendingItems as PendingItem[]) ?? [],
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, boardId, setAll]);

  return useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const provider = getSheetProvider();
      const [board, fields, cards, pendingItems] = await Promise.all([
        provider.loadBoard(boardId),
        provider.loadFields(boardId),
        provider.loadCards(boardId),
        provider.loadPendingItems(boardId),
      ]);
      setAll(board, fields, cards, boardId, pendingItems);
      await cacheSet(cacheKey, { board, fields, cards, pendingItems });
      return { board, fields, cards, pendingItems };
    },
    enabled: !!boardId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
