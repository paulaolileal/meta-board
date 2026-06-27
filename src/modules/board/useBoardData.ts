import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSheetProvider, isMockMode, envSpreadsheetId } from "@/shared/providers/providerFactory";
import { ENV_CONNECTION_ID } from "@/routes/HomePage";
import { useBoardStore } from "@/modules/board/store";
import { useSpreadsheetStore } from "@/modules/project/store/spreadsheetStore";
import { cacheGet, cacheSet } from "@/shared/cache/localCache";

const MOCK_SHEET_ID = "mock";

export function useBoardData(connectionId: string, boardId: string) {
  const setAll = useBoardStore((s) => s.setAll);
  const connections = useSpreadsheetStore((s) => s.connections);

  const sheetId = isMockMode()
    ? MOCK_SHEET_ID
    : connectionId === ENV_CONNECTION_ID
      ? (envSpreadsheetId ?? "")
      : (connections.find((c) => c.id === connectionId)?.sheetId ?? "");

  const cacheKey = `board:${connectionId}:${boardId}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await cacheGet<{ board: unknown; fields: unknown; cards: unknown }>(cacheKey);
      if (cached && !cancelled) {
        setAll(cached.board as any, cached.fields as any, cached.cards as any, connectionId, boardId);
      }
    })();
    return () => { cancelled = true; };
  }, [cacheKey, connectionId, boardId, setAll]);

  return useQuery({
    queryKey: ["board", connectionId, boardId],
    queryFn: async () => {
      const provider = getSheetProvider(sheetId);
      const [board, fields, cards] = await Promise.all([
        provider.loadBoard(boardId),
        provider.loadFields(boardId),
        provider.loadCards(boardId),
      ]);
      setAll(board, fields, cards, connectionId, boardId);
      await cacheSet(cacheKey, { board, fields, cards });
      return { board, fields, cards };
    },
    enabled: !!connectionId && !!boardId && (isMockMode() || !!sheetId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
