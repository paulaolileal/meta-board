import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSheetProvider, isMockMode, envSpreadsheetId } from "@/shared/providers/providerFactory";
import { useBoardStore } from "@/modules/board/store";
import { cacheGet, cacheSet } from "@/shared/cache/localCache";

const MOCK_SHEET_ID = "mock";

export function useBoardData(boardId: string) {
  const setAll = useBoardStore((s) => s.setAll);

  const sheetId = isMockMode() ? MOCK_SHEET_ID : (envSpreadsheetId ?? "");
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
      const provider = getSheetProvider(sheetId);
      const [board, fields, cards] = await Promise.all([
        provider.loadBoard(boardId),
        provider.loadFields(boardId),
        provider.loadCards(boardId),
      ]);
      setAll(board, fields, cards, boardId);
      await cacheSet(cacheKey, { board, fields, cards });
      return { board, fields, cards };
    },
    enabled: !!boardId && (isMockMode() || !!sheetId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
