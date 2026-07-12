import { create } from "zustand";
import type { CardRecord, FieldDef, BoardConfig } from "@/modules/project/domain/types";

interface BoardState {
  board: BoardConfig | null;
  fields: FieldDef[];
  cards: CardRecord[];
  boardId: string | null;
  search: string;
  filterTags: string[];
  openCardId: string | null;
  hydrated: boolean;

  setAll: (board: BoardConfig, fields: FieldDef[], cards: CardRecord[], boardId: string) => void;
  setBoard: (board: BoardConfig) => void;
  setFields: (fields: FieldDef[]) => void;
  setCards: (cards: CardRecord[]) => void;
  setSearch: (q: string) => void;
  toggleFilterTag: (t: string) => void;
  clearFilters: () => void;
  openCard: (id: string | null) => void;
  upsertCard: (c: CardRecord) => void;
  removeCard: (id: string) => void;
  reorderCards: (cards: CardRecord[]) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  board: null,
  fields: [],
  cards: [],
  boardId: null,
  search: "",
  filterTags: [],
  openCardId: null,
  hydrated: false,

  setAll: (board, fields, cards, boardId) => set({ board, fields, cards, boardId, hydrated: true }),

  setBoard: (board) => set({ board }),

  setFields: (fields) => set({ fields }),

  setCards: (cards) => set({ cards }),

  setSearch: (search) => set({ search }),

  toggleFilterTag: (t) =>
    set((s) => ({
      filterTags: s.filterTags.includes(t)
        ? s.filterTags.filter((x) => x !== t)
        : [...s.filterTags, t],
    })),

  clearFilters: () => set({ search: "", filterTags: [] }),

  openCard: (id) => set({ openCardId: id }),

  upsertCard: (c) =>
    set((s) => {
      const idx = s.cards.findIndex((x) => x._id === c._id);
      const next = [...s.cards];
      if (idx >= 0) next[idx] = c;
      else next.push(c);
      return { cards: next };
    }),

  removeCard: (id) => set((s) => ({ cards: s.cards.filter((c) => c._id !== id) })),

  reorderCards: (cards) => set({ cards }),
}));
