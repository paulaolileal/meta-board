import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSheetProvider } from "@/shared/providers/providerFactory";
import { useBoardStore } from "@/modules/board/store";
import { cacheGet, cacheSet } from "@/shared/cache/localCache";

export function useBoardData(boardId: string) {
  const setAll = useBoardStore((s) => s.setAll);
  const cacheKey = `board:${boardId}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await cacheGet<{ board: unknown; fields: unknown; cards: unknown }>(cacheKey);
      if (cached && !cancelled) {
        setAll(cached.board as any, cached.fields as any, cached.cards as any, boardId);
      }
    })();
    return () => { cancelled = true; };
  }, [cacheKey, boardId, setAll]);

  return useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const provider = getSheetProvider();
      const [board, fields, cards] = await Promise.all([
        provider.loadBoard(boardId),
        provider.loadFields(boardId),
        provider.loadCards(boardId),
      ]);
      setAll(board, fields, cards, boardId);
      await cacheSet(cacheKey, { board, fields, cards });
      return { board, fields, cards };
    },
    enabled: !!boardId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
