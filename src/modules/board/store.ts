import { create } from "zustand";
import type { CardRecord, FieldDef, ProjectConfig } from "@/modules/project/domain/types";

interface BoardState {
  project: ProjectConfig | null;
  fields: FieldDef[];
  cards: CardRecord[];
  search: string;
  filterTags: string[];
  openCardId: string | null;
  hydrated: boolean;
  setAll: (p: ProjectConfig, f: FieldDef[], c: CardRecord[]) => void;
  setSearch: (q: string) => void;
  toggleFilterTag: (t: string) => void;
  clearFilters: () => void;
  openCard: (id: string | null) => void;
  upsertCard: (c: CardRecord) => void;
  removeCard: (id: string) => void;
  reorderCards: (cards: CardRecord[]) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  project: null,
  fields: [],
  cards: [],
  search: "",
  filterTags: [],
  openCardId: null,
  hydrated: false,
  setAll: (project, fields, cards) => set({ project, fields, cards, hydrated: true }),
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
