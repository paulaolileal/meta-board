import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CardRecord, FieldDef } from "@/modules/project/domain/types";
import { FieldRenderer } from "@/modules/fields/FieldRenderer";
import { cn } from "@/lib/utils";

interface Props {
  card: CardRecord;
  fields: FieldDef[];
  layout: string[];
  onClick: () => void;
  dragging?: boolean;
}

export function CardItem({ card, fields, layout, onClick, dragging }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card._id, data: { type: "card", card } });

  const fieldMap = new Map(fields.map((f) => [f.id, f]));
  const cover = card["coverImage"];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      whileHover={{ y: -2 }}
      className={cn(
        "group cursor-pointer rounded-2xl bg-card border border-border overflow-hidden",
        "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] transition-shadow",
        (isDragging || dragging) && "opacity-50 ring-2 ring-primary/50"
      )}
    >
      {cover && layout.includes("coverImage") ? (
        <FieldRenderer
          field={fieldMap.get("coverImage")!}
          value={cover as string}
          mode="closed"
        />
      ) : null}

      <div className="p-3 space-y-2">
        {layout
          .filter((id) => id !== "coverImage")
          .map((id) => {
            const f = fieldMap.get(id);
            if (!f) return null;
            const v = card[id] as never;
            if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
            return (
              <div key={id} className={f.type === "title" ? "" : ""}>
                <FieldRenderer field={f} value={v} mode="closed" />
              </div>
            );
          })}
      </div>
    </motion.div>
  );
}
