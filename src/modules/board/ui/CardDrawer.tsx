import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Trash2, Calendar, Link as LinkIcon } from "lucide-react";
import { useBoardStore } from "@/modules/board/store";
import { useCardMutations } from "@/modules/board/useCardMutations";
import { FieldRenderer } from "@/modules/fields/FieldRenderer";
import type { CardRecord, FieldDef, ChecklistItem } from "@/modules/project/domain/types";
import { cn } from "@/lib/utils";

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
}) {
  switch (field.type) {
    case "text":
      return (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      );
    case "longtext":
      return (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none"
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm"
        />
      );
    case "bool":
      return (
        <button
          onClick={() => onChange(!value)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium",
            value ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          {value ? "Sim" : "Não"}
        </button>
      );
    case "date":
      return (
        <div className="relative">
          <Calendar className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="date"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm"
          />
        </div>
      );
    case "url":
      return (
        <div className="relative">
          <LinkIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="url"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm"
          />
        </div>
      );
    case "image":
      return (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="URL da imagem"
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm"
        />
      );
    case "select":
    case "chip":
      return (
        <div className="flex flex-wrap gap-1.5">
          {(field.options ?? []).map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium border transition",
                value === opt
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface border-border hover:border-primary/40"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    case "multiselect": {
      const arr: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {(field.options ?? []).map((opt) => {
            const on = arr.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => onChange(on ? arr.filter((x) => x !== opt) : [...arr, opt])}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] font-medium border transition",
                  on
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-surface border-border hover:border-primary/40"
                )}
              >
                #{opt}
              </button>
            );
          })}
        </div>
      );
    }
    case "checklist": {
      const items: ChecklistItem[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={it.id} className="flex items-center gap-2 group">
              <input
                type="checkbox"
                checked={it.done}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...it, done: e.target.checked };
                  onChange(next);
                }}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <input
                value={it.text}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...it, text: e.target.value };
                  onChange(next);
                }}
                className={cn(
                  "flex-1 bg-transparent text-sm border-b border-transparent focus:border-border focus:outline-none py-0.5",
                  it.done && "line-through text-muted-foreground"
                )}
              />
              <button
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger text-xs"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              onChange([
                ...items,
                { id: crypto.randomUUID(), text: "Novo item", done: false },
              ])
            }
            className="text-xs text-primary hover:underline"
          >
            + adicionar item
          </button>
        </div>
      );
    }
    default:
      return (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm"
        />
      );
  }
}

export function CardDrawer() {
  const openCardId = useBoardStore((s) => s.openCardId);
  const cards = useBoardStore((s) => s.cards);
  const fields = useBoardStore((s) => s.fields);
  const project = useBoardStore((s) => s.project);
  const close = useBoardStore((s) => s.openCard);
  const { updateCard, deleteCard } = useCardMutations();

  const card = cards.find((c) => c._id === openCardId) ?? null;
  const [draft, setDraft] = useState<CardRecord | null>(card);

  useEffect(() => {
    setDraft(card);
  }, [card?._id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(null);
    }
    if (openCardId) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCardId, close]);

  const cover = draft?.["coverImage"] as string | undefined;
  const layoutAll = project?.cardOpenLayout === "*" || !project?.cardOpenLayout;
  const layout = layoutAll
    ? fields.map((f) => f.id)
    : (project!.cardOpenLayout as string[]);

  function patch<K extends string>(key: K, v: unknown) {
    if (!draft) return;
    const next = { ...draft, [key]: v } as CardRecord;
    setDraft(next);
    updateCard(next);
  }

  return (
    <AnimatePresence>
      {draft && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => close(null)}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-background border-l border-border z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="text-xs text-muted-foreground">
                Card · atualizado {new Date(draft._updatedAt).toLocaleTimeString("pt-BR")}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    deleteCard(draft._id);
                    close(null);
                  }}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-danger hover:bg-danger/10"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => close(null)}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {cover && (
                <img src={cover} alt="" className="w-full h-48 object-cover" />
              )}

              <div className="p-6 space-y-5">
                <input
                  value={(draft["title"] as string) ?? ""}
                  onChange={(e) => patch("title", e.target.value)}
                  placeholder="Sem título"
                  className="w-full text-2xl font-semibold bg-transparent border-0 focus:outline-none placeholder:text-muted-foreground"
                />

                {layout
                  .filter((id) => id !== "title")
                  .map((id) => {
                    const f = fields.find((x) => x.id === id);
                    if (!f || f.visible === false) return null;
                    return (
                      <div key={id} className="space-y-1.5">
                        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {f.label}
                        </label>
                        {f.editable === false ? (
                          <FieldRenderer field={f} value={draft[id] as never} mode="open" />
                        ) : (
                          <FieldEditor
                            field={f}
                            value={draft[id]}
                            onChange={(v) => patch(id, v)}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
