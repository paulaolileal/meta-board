import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SpreadsheetConnection } from "@/modules/project/domain/types";

interface SpreadsheetState {
  connections: SpreadsheetConnection[];
  addConnection: (conn: SpreadsheetConnection) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, patch: Partial<SpreadsheetConnection>) => void;
  touch: (id: string) => void;
}

export const useSpreadsheetStore = create<SpreadsheetState>()(
  persist(
    (set) => ({
      connections: [],

      addConnection: (conn) =>
        set((s) => {
          const exists = s.connections.some((c) => c.sheetId === conn.sheetId);
          if (exists) return s;
          return { connections: [...s.connections, conn] };
        }),

      removeConnection: (id) =>
        set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),

      updateConnection: (id, patch) =>
        set((s) => ({
          connections: s.connections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      touch: (id) =>
        set((s) => ({
          connections: s.connections.map((c) =>
            c.id === id ? { ...c, lastAccessedAt: new Date().toISOString() } : c,
          ),
        })),
    }),
    { name: "metaboard:connections" },
  ),
);
