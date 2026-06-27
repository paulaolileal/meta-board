import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useBoardStore } from "@/modules/board/store";
import { useCardMutations } from "@/modules/board/useCardMutations";
import { CardItem } from "./CardItem";
import { CardDrawer } from "./CardDrawer";
import type { CardRecord } from "@/modules/project/domain/types";
import { cn } from "@/lib/utils";

function Column({
  title,
  cards,
  onAdd,
  onOpen,
  layout,
}: {
  title: string;
  cards: CardRecord[];
  onAdd: () => void;
  onOpen: (id: string) => void;
  layout: string[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${title}`, data: { type: "column", status: title } });
  const fields = useBoardStore((s) => s.fields);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[300px] shrink-0 rounded-2xl bg-surface/60 border border-border p-3 gap-3 max-h-full",
        isOver && "ring-2 ring-primary/40 bg-surface"
      )}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{title}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground tabular-nums">
            {cards.length}
          </span>
        </div>
        <button
          onClick={onAdd}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
          aria-label="Adicionar card"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto scrollbar-thin pr-1 min-h-[40px]">
        <SortableContext items={cards.map((c) => c._id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {cards.map((card) => (
              <CardItem
                key={card._id}
                card={card}
                fields={fields}
                layout={layout}
                onClick={() => onOpen(card._id)}
              />
            ))}
          </AnimatePresence>
        </SortableContext>
        {cards.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border rounded-xl">
            Solte cards aqui
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const project = useBoardStore((s) => s.project);
  const fields = useBoardStore((s) => s.fields);
  const cards = useBoardStore((s) => s.cards);
  const search = useBoardStore((s) => s.search);
  const filterTags = useBoardStore((s) => s.filterTags);
  const openCard = useBoardStore((s) => s.openCard);
  const { persistReorder, createCard, updateCard } = useCardMutations();
  const [active, setActive] = useState<CardRecord | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const groupField = project?.groupBy ?? "status";
  const groups: string[] = useMemo(() => {
    const f = fields.find((x) => x.id === groupField);
    return f?.options?.length ? f.options : Array.from(new Set(cards.map((c) => String(c[groupField] ?? ""))));
  }, [fields, cards, groupField]);

  const filtered = useMemo(() => {
    let list = cards.filter((c) => !c._archived);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        fields.some(
          (f) =>
            f.searchable !== false &&
            String(c[f.id] ?? "").toLowerCase().includes(q)
        )
      );
    }
    if (filterTags.length) {
      list = list.filter((c) => {
        const tags = (c["tags"] as string[]) ?? [];
        return filterTags.every((t) => tags.includes(t));
      });
    }
    return list.sort((a, b) => (a._sort ?? 0) - (b._sort ?? 0));
  }, [cards, fields, search, filterTags]);

  const byGroup = useMemo(() => {
    const map = new Map<string, CardRecord[]>();
    groups.forEach((g) => map.set(g, []));
    filtered.forEach((c) => {
      const key = String(c[groupField] ?? groups[0] ?? "");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return map;
  }, [filtered, groups, groupField]);

  const layout = project?.cardClosedLayout ?? ["title"];

  function handleDragStart(e: DragStartEvent) {
    const card = cards.find((c) => c._id === e.active.id);
    setActive(card ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActive(null);
    const { active: a, over } = e;
    if (!over) return;
    const activeCard = cards.find((c) => c._id === a.id);
    if (!activeCard) return;

    let targetStatus = String(activeCard[groupField]);
    let overCard: CardRecord | undefined;
    if (typeof over.id === "string" && over.id.startsWith("col:")) {
      targetStatus = over.id.slice(4);
    } else {
      overCard = cards.find((c) => c._id === over.id);
      if (overCard) targetStatus = String(overCard[groupField]);
    }

    const updated: CardRecord = { ...activeCard, [groupField]: targetStatus };

    // Reorder within or across columns
    const without = cards.filter((c) => c._id !== activeCard._id);
    const targetList = without.filter((c) => String(c[groupField]) === targetStatus);
    let insertIndex = targetList.length;
    if (overCard) {
      insertIndex = targetList.findIndex((c) => c._id === overCard!._id);
      if (insertIndex < 0) insertIndex = targetList.length;
    }
    targetList.splice(insertIndex, 0, updated);

    const others = without.filter((c) => String(c[groupField]) !== targetStatus);
    const merged = [...others, ...targetList].map((c, i) => ({ ...c, _sort: i }));

    persistReorder(merged);
    updateCard(updated);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto scrollbar-thin h-full p-6 pt-4">
          {groups.map((g) => (
            <Column
              key={g}
              title={g}
              cards={byGroup.get(g) ?? []}
              layout={layout}
              onOpen={openCard}
              onAdd={() => createCard({ [groupField]: g, title: "Novo card" } as Partial<CardRecord>)}
            />
          ))}
        </div>
        <DragOverlay>
          {active ? (
            <motion.div initial={{ scale: 1 }} animate={{ scale: 1.04, rotate: 1.5 }}>
              <div className="w-[284px] rounded-2xl bg-card border border-border shadow-[var(--shadow-glow)] p-3 pointer-events-none">
                <div className="font-semibold text-sm">{String(active["title"])}</div>
              </div>
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <CardDrawer />
    </>
  );
}
