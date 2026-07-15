import { create } from "zustand";
import type {
  CardRecord,
  FieldDef,
  BoardConfig,
  PendingItem,
} from "@/modules/project/domain/types";

interface BoardState {
  board: BoardConfig | null;
  fields: FieldDef[];
  cards: CardRecord[];
  pendingItems: PendingItem[];
  boardId: string | null;
  search: string;
  filterTags: string[];
  openCardId: string | null;
  hydrated: boolean;

  setAll: (
    board: BoardConfig,
    fields: FieldDef[],
    cards: CardRecord[],
    boardId: string,
    pendingItems?: PendingItem[],
  ) => void;
  setBoard: (board: BoardConfig) => void;
  setFields: (fields: FieldDef[]) => void;
  setCards: (cards: CardRecord[]) => void;
  setPendingItems: (pendingItems: PendingItem[]) => void;
  setSearch: (q: string) => void;
  toggleFilterTag: (t: string) => void;
  clearFilters: () => void;
  openCard: (id: string | null) => void;
  upsertCard: (c: CardRecord) => void;
  removeCard: (id: string) => void;
  reorderCards: (cards: CardRecord[]) => void;
  upsertPendingItem: (p: PendingItem) => void;
  removePendingItem: (id: string) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  board: null,
  fields: [],
  cards: [],
  pendingItems: [],
  boardId: null,
  search: "",
  filterTags: [],
  openCardId: null,
  hydrated: false,

  setAll: (board, fields, cards, boardId, pendingItems = []) =>
    set({ board, fields, cards, pendingItems, boardId, hydrated: true }),

  setBoard: (board) => set({ board }),

  setFields: (fields) => set({ fields }),

  setCards: (cards) => set({ cards }),

  setPendingItems: (pendingItems) => set({ pendingItems }),

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

  upsertPendingItem: (p) =>
    set((s) => {
      const idx = s.pendingItems.findIndex((x) => x._id === p._id);
      const next = [...s.pendingItems];
      if (idx >= 0) next[idx] = p;
      else next.push(p);
      return { pendingItems: next };
    }),

  removePendingItem: (id) =>
    set((s) => ({ pendingItems: s.pendingItems.filter((p) => p._id !== id) })),
}));
