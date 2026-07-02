import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SpreadsheetState {
  byEmail: Record<string, string>;
  setSpreadsheetId: (email: string, id: string) => void;
  getSpreadsheetId: (email: string) => string | undefined;
  clearSpreadsheetId: (email: string) => void;
}

export const useSpreadsheetStore = create<SpreadsheetState>()(
  persist(
    (set, get) => ({
      byEmail: {},
      setSpreadsheetId: (email, id) =>
        set((s) => ({ byEmail: { ...s.byEmail, [email]: id } })),
      getSpreadsheetId: (email) => get().byEmail[email],
      clearSpreadsheetId: (email) =>
        set((s) => {
          const next = { ...s.byEmail };
          delete next[email];
          return { byEmail: next };
        }),
    }),
    { name: "metaboard:spreadsheets" },
  ),
);
