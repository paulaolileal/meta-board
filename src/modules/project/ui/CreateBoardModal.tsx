import { useState } from "react";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Type,
  AlignLeft,
  Hash,
  ToggleLeft,
  Calendar,
  CalendarClock,
  Link,
  Image,
  Tag,
  ListFilter,
  List,
  ListChecks,
  Mail,
  Palette,
  Smile,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getSheetProvider } from "@/shared/providers/providerFactory";
import type { BoardConfig, FieldDef, FieldType } from "@/modules/project/domain/types";
import { BoardIconPicker } from "@/shared/icons/BoardIconPicker";
import { BoardColorPicker } from "@/shared/colors/BoardColorPicker";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (board: BoardConfig) => void;
}

interface CustomField {
  name: string;
  type: FieldType;
}

const FIELD_TYPE_OPTIONS: { type: FieldType; label: string; Icon: React.ElementType }[] = [
  { type: "text",        label: "Texto",           Icon: Type },
  { type: "longtext",    label: "Texto longo",      Icon: AlignLeft },
  { type: "number",      label: "Número",           Icon: Hash },
  { type: "bool",        label: "Booleano",         Icon: ToggleLeft },
  { type: "date",        label: "Data",             Icon: Calendar },
  { type: "datetime",    label: "Data e hora",      Icon: CalendarClock },
  { type: "url",         label: "URL",              Icon: Link },
  { type: "image",       label: "Imagem",           Icon: Image },
  { type: "icon",        label: "Ícone",            Icon: Smile },
  { type: "chip",        label: "Chip",             Icon: Tag },
  { type: "select",      label: "Seleção",          Icon: ListFilter },
  { type: "multiselect", label: "Multi-seleção",    Icon: List },
  { type: "checklist",   label: "Checklist",        Icon: ListChecks },
  { type: "email",       label: "E-mail",           Icon: Mail },
  { type: "color",       label: "Cor",              Icon: Palette },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildFields(customFields: CustomField[]): FieldDef[] {
  const titleField: FieldDef = {
    id: "title",
    boardId: "",
    label: "Título",
    type: "text",
    required: true,
    visible: true,
    editable: true,
    searchable: true,
    sortable: true,
    displayOrder: 0,
  };

  const slugCounts: Record<string, number> = {};
  const additionalFields: FieldDef[] = customFields
    .filter((f) => f.name.trim())
    .map((f, i) => {
      const base = slugify(f.name.trim()) || `field_${i + 1}`;
      slugCounts[base] = (slugCounts[base] ?? 0) + 1;
      const id = slugCounts[base] > 1 ? `${base}_${slugCounts[base]}` : base;
      return {
        id,
        boardId: "",
        label: f.name.trim(),
        type: f.type,
        visible: true,
        editable: true,
        searchable: f.type === "text" || f.type === "longtext" || f.type === "email",
        sortable: true,
        displayOrder: i + 1,
      };
    });

  return [titleField, ...additionalFields];
}

export function CreateBoardModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("KanbanSquare");
  const [color, setColor] = useState("#7c3aed");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFields, setShowFields] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  function addField() {
    setCustomFields((prev) => [...prev, { name: "", type: "text" }]);
  }

  function removeField(index: number) {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  }

  function updateField(index: number, patch: Partial<CustomField>) {
    setCustomFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Nome é obrigatório"); return; }
    setError("");
    setLoading(true);

    try {
      const provider = getSheetProvider();

      if (!provider.createBoard) {
        throw new Error("Este provider não suporta criação de boards");
      }

      if (provider.initializeSpreadsheet) {
        await provider.initializeSpreadsheet();
      }

      const fields = buildFields(customFields);
      const fieldIds = fields.map((f) => f.id);

      const board = await provider.createBoard(
        {
          name: name.trim(),
          icon,
          color: color || undefined,
          description: description.trim() || undefined,
          groupBy: "status",
          orderBy: "_sort",
          cardTitleField: "title",
          cardDescriptionField: undefined,
          cardClosedLayout: fieldIds.slice(0, 4),
          cardOpenLayout: "*",
        },
        fields,
      );

      onCreated(board);
      setName("");
      setDescription("");
      setIcon("KanbanSquare");
      setColor("#7c3aed");
      setCustomFields([]);
      setShowFields(false);
    } catch (e) {
      setError((e as Error)?.message ?? "Erro ao criar board");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo board</DialogTitle>
          <DialogDescription>
            Cria um novo board nesta planilha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-end gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                Ícone
              </label>
              <BoardIconPicker value={icon} onChange={setIcon} color={color} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                Cor
              </label>
              <BoardColorPicker value={color} onChange={setColor} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome *</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Ex: Dev Tracker"
              className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Opcional"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowFields((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
            >
              {showFields ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Personalizar campos
            </button>

            {showFields && (
              <div className="mt-3 space-y-2">
                {customFields.map((field, index) => (
                  <FieldRow
                    key={index}
                    field={field}
                    onChange={(patch) => updateField(index, patch)}
                    onRemove={() => removeField(index)}
                  />
                ))}

                <button
                  type="button"
                  onClick={addField}
                  className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80 transition font-medium mt-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar campo
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || loading}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar board
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FieldRowProps {
  field: CustomField;
  onChange: (patch: Partial<CustomField>) => void;
  onRemove: () => void;
}

function FieldRow({ field, onChange, onRemove }: FieldRowProps) {
  const selected = FIELD_TYPE_OPTIONS.find((o) => o.type === field.type) ?? FIELD_TYPE_OPTIONS[0];

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={field.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Nome do campo"
        className="flex-1 min-w-0 px-2.5 py-1.5 bg-surface border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
      />

      <div className="relative">
        <select
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value as FieldType })}
          className="appearance-none pl-7 pr-6 py-1.5 bg-surface border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 cursor-pointer"
        >
          {FIELD_TYPE_OPTIONS.map((opt) => (
            <option key={opt.type} value={opt.type}>
              {opt.label}
            </option>
          ))}
        </select>
        <selected.Icon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition text-muted-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
