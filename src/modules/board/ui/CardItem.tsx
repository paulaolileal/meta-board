import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CardRecord, FieldDef, FieldType, FieldValue } from "@/modules/project/domain/types";
import { FieldRenderer } from "@/modules/fields/FieldRenderer";
import { cn } from "@/lib/utils";

interface Props {
  card: CardRecord;
  fields: FieldDef[];
  layout: string[];
  onClick: () => void;
  dragging?: boolean;
}

const WIDE_FIELD_TYPES = new Set<FieldType>(["longtext", "longnumber", "checklist", "multiselect"]);

export function CardItem({ card, fields, layout, onClick, dragging }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card._id,
    data: { type: "card", card },
  });

  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  const imageFieldId = layout.find((id) => fieldMap.get(id)?.type === "image");
  const imageField = imageFieldId ? fieldMap.get(imageFieldId) : undefined;
  const imageValue = imageFieldId ? (card[imageFieldId] as string | undefined) : undefined;

  const nonImageLayout = layout.filter((id) => fieldMap.get(id)?.type !== "image");
  const [titleId, ...bodyIds] = nonImageLayout;
  const titleField = titleId ? fieldMap.get(titleId) : undefined;
  const titleValue = titleId != null ? (card[titleId] as FieldValue) : undefined;

  const hasCollapsible =
    (imageField && imageValue) ||
    bodyIds.some((id) => {
      const v = card[id];
      return v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
    });

  const style = { transform: CSS.Transform.toString(transform), transition };

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setCollapsed((v) => !v);
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      whileHover={{ y: -2 }}
      className={cn(
        "group cursor-pointer rounded-2xl bg-card border border-border",
        "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] transition-shadow",
        (isDragging || dragging) && "opacity-50 ring-2 ring-primary/50",
      )}
    >
      <AnimatePresence initial={false}>
        {!collapsed && imageField && imageValue && (
          <motion.div
            key="image"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <FieldRenderer field={imageField} value={imageValue} mode="closed" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-1.5">
          {titleField && titleValue != null && titleValue !== "" && (
            <div className="flex-1 min-w-0 text-sm font-semibold leading-snug">
              <FieldRenderer field={titleField} value={titleValue} mode="closed" />
            </div>
          )}
          {hasCollapsible && (
            <button
              onClick={handleToggle}
              className="shrink-0 mt-0.5 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label={collapsed ? "Expandir card" : "Colapsar card"}
            >
              {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {!collapsed && bodyIds.length > 0 && (
            <motion.div
              key="body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.16 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-2">
                {bodyIds.map((id) => {
                  const f = fieldMap.get(id);
                  if (!f) return null;
                  const v = card[id] as FieldValue;
                  if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
                  const isWide = WIDE_FIELD_TYPES.has(f.type);
                  return (
                    <div key={id} className={isWide ? "col-span-2 sm:col-span-3" : "col-span-1"}>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-0.5">
                        {f.label}
                      </span>
                      <FieldRenderer field={f} value={v} mode="closed" />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
