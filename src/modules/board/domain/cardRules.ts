import type { CardRecord, FieldDef } from "@/modules/project/domain/types";

// Business rules shared between the app UI and any external caller (e.g. the
// local MCP server in mcp-server/) that manipulates cards without going
// through the React components. Keeping this logic here — instead of inline
// in CreateCardModal/KanbanBoard — avoids re-implementing it in two places.

/**
 * Returns a map of fieldId -> error message for every required, editable
 * field that is missing or blank in `values`. Empty object means valid.
 */
export function validateRequiredFields(
  fields: FieldDef[],
  values: Partial<CardRecord>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  fields
    .filter((f) => f.required)
    .forEach((f) => {
      const val = values[f.id as keyof typeof values];
      if (val == null || (typeof val === "string" && !val.trim())) {
        errors[f.id] = `${f.label} é obrigatório`;
      }
    });
  return errors;
}

/**
 * Moves `activeCardId` into `targetGroupValue` (optionally before
 * `beforeCardId`) and returns a new card list with `_sort` renumbered
 * sequentially across the whole board — mirrors the drag-and-drop behavior
 * in KanbanBoard: `_sort` only needs to be relative (final ordering sorts by
 * it ascending), not densely unique per column.
 */
export function moveCardAndReorder(
  cards: CardRecord[],
  activeCardId: string,
  groupField: string,
  targetGroupValue: string,
  beforeCardId?: string,
): CardRecord[] {
  const activeCard = cards.find((c) => c._id === activeCardId);
  if (!activeCard) return cards;

  const updated: CardRecord = { ...activeCard, [groupField]: targetGroupValue };
  const without = cards.filter((c) => c._id !== activeCardId);
  const targetList = without.filter((c) => String(c[groupField]) === targetGroupValue);

  let insertIndex = targetList.length;
  if (beforeCardId) {
    const idx = targetList.findIndex((c) => c._id === beforeCardId);
    if (idx >= 0) insertIndex = idx;
  }
  targetList.splice(insertIndex, 0, updated);

  const others = without.filter((c) => String(c[groupField]) !== targetGroupValue);
  return [...others, ...targetList].map((c, i) => ({ ...c, _sort: i }));
}
