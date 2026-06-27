import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSheetProvider } from "@/shared/providers/providerFactory";
import { useBoardStore } from "@/modules/board/store";
import { cacheGet, cacheSet } from "@/shared/cache/localCache";

/**
 * Stale-while-revalidate load:
 * 1. hydrate from IndexedDB cache (L2) immediately
 * 2. fetch fresh data from provider in background
 * 3. write back to cache + store
 */
export function useBoardData() {
  const setAll = useBoardStore((s) => s.setAll);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await cacheGet<{ project: any; fields: any; cards: any }>("board");
      if (cached && !cancelled) setAll(cached.project, cached.fields, cached.cards);
    })();
    return () => {
      cancelled = true;
    };
  }, [setAll]);

  return useQuery({
    queryKey: ["board"],
    queryFn: async () => {
      const provider = getSheetProvider();
      const [project, fields, cards] = await Promise.all([
        provider.loadProject(),
        provider.loadFields(),
        provider.loadCards(),
      ]);
      setAll(project, fields, cards);
      await cacheSet("board", { project, fields, cards });
      return { project, fields, cards };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
