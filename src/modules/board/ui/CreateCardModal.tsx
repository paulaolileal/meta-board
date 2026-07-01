import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FieldEditor } from "./CardDrawer";
import { useCardMutations } from "@/modules/board/useCardMutations";
import { useBoardStore } from "@/modules/board/store";
import type { CardRecord } from "@/modules/project/domain/types";

interface Props {
  open: boolean;
  onClose: () => void;
  initialValues: Partial<CardRecord>;
}

export function CreateCardModal({ open, onClose, initialValues }: Props) {
  const fields = useBoardStore((s) => s.fields);
  const { createCard } = useCardMutations();

  const [values, setValues] = useState<Partial<CardRecord>>(initialValues);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const editableFields = fields.filter((f) => f.editable !== false && f.visible !== false);

  function setField(id: string, value: unknown) {
    setValues((prev) => ({ ...prev, [id]: value as never }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleCreate() {
    const newErrors: Record<string, string> = {};
    editableFields
      .filter((f) => f.required)
      .forEach((f) => {
        const val = values[f.id as keyof typeof values];
        if (val == null || (typeof val === "string" && !val.trim())) {
          newErrors[f.id] = `${f.label} é obrigatório`;
        }
      });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await createCard(values);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Novo card</DialogTitle>
          <DialogDescription>Preencha os dados do card.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 mt-2 pr-1">
          {editableFields.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                {f.label}
                {f.required && <span className="text-danger">*</span>}
              </label>
              <FieldEditor
                field={f}
                value={values[f.id as keyof typeof values] as never}
                onChange={(v) => setField(f.id, v)}
              />
              {errors[f.id] && <p className="text-xs text-danger">{errors[f.id]}</p>}
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t border-border mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar card
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
