import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, ChevronDown, ChevronUp, X, Columns3, Tag, AlignLeft, Hash, ToggleLeft, Calendar, Link, Image, Smile, ListFilter, List, ListChecks, Mail, Palette, Type, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import type { FieldDef, FieldType } from "@/modules/project/domain/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getSheetProvider, isMockMode, envSpreadsheetId } from "@/shared/providers/providerFactory";
import { useBoardStore } from "@/modules/board/store";
import { useSpreadsheetStore } from "@/modules/project/store/spreadsheetStore";
import { ENV_CONNECTION_ID } from "@/routes/HomePage";

const MOCK_SHEET_ID = "mock";
const EMOJIS = ["📋", "🚀", "✨", "📣", "🎯", "🛠️", "📊", "🔥", "💡", "🌟"];
const SELECT_TYPES: FieldType[] = ["select", "chip", "multiselect"];

const FIELD_TYPE_ORDER: FieldType[] = [
  "text", "longtext", "number", "bool", "date", "datetime",
  "url", "image", "icon", "chip", "select", "multiselect", "checklist", "email", "color",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const FIELD_TYPE_ICONS: Record<FieldType, React.ElementType> = {
  text: Type,
  longtext: AlignLeft,
  number: Hash,
  bool: ToggleLeft,
  date: Calendar,
  datetime: CalendarClock,
  url: Link,
  image: Image,
  icon: Smile,
  chip: Tag,
  select: ListFilter,
  multiselect: List,
  checklist: ListChecks,
  email: Mail,
  color: Palette,
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto",
  longtext: "Texto longo",
  number: "Número",
  bool: "Booleano",
  date: "Data",
  datetime: "Data e hora",
  url: "URL",
  image: "Imagem",
  icon: "Ícone",
  chip: "Chip",
  select: "Seleção",
  multiselect: "Multi-seleção",
  checklist: "Checklist",
  email: "E-mail",
  color: "Cor",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function EditBoardModal({ open, onClose }: Props) {
  const board = useBoardStore((s) => s.board);
  const fields = useBoardStore((s) => s.fields);
  const setBoard = useBoardStore((s) => s.setBoard);
  const setFields = useBoardStore((s) => s.setFields);
  const connectionId = useBoardStore((s) => s.connectionId);
  const connections = useSpreadsheetStore((s) => s.connections);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📋");
  const [description, setDescription] = useState("");
  const [groupBy, setGroupBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [addingField, setAddingField] = useState(false);
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const [fieldOptionsMap, setFieldOptionsMap] = useState<Record<string, string[]>>({});
  const [newOptionByField, setNewOptionByField] = useState<Record<string, string>>({});

  const groupableFields = useMemo(
    () => fields.filter((f) => SELECT_TYPES.includes(f.type)),
    [fields],
  );

  const sheetId = useMemo(() => {
    if (isMockMode()) return MOCK_SHEET_ID;
    if (connectionId === ENV_CONNECTION_ID) return envSpreadsheetId ?? "";
    return connections.find((c) => c.id === connectionId)?.sheetId ?? "";
  }, [connectionId, connections]);

  const provider = useMemo(() => getSheetProvider(sheetId), [sheetId]);

  useEffect(() => {
    if (open && board) {
      setName(board.name);
      setIcon(board.icon);
      setDescription(board.description ?? "");
      setGroupBy(board.groupBy ?? "");
      setExpandedFieldId(null);
      setFieldOptionsMap({});
      setNewOptionByField({});
    }
  }, [open, board]);

  function getFieldOptions(fieldId: string): string[] {
    if (fieldId in fieldOptionsMap) return fieldOptionsMap[fieldId];
    return fields.find((f) => f.id === fieldId)?.options ?? [];
  }

  function addFieldOption(fieldId: string) {
    const input = (newOptionByField[fieldId] ?? "").trim();
    if (!input) return;
    const current = getFieldOptions(fieldId);
    if (current.includes(input)) return;
    setFieldOptionsMap((prev) => ({ ...prev, [fieldId]: [...current, input] }));
    setNewOptionByField((prev) => ({ ...prev, [fieldId]: "" }));
  }

  function removeFieldOption(fieldId: string, opt: string) {
    const current = getFieldOptions(fieldId);
    setFieldOptionsMap((prev) => ({ ...prev, [fieldId]: current.filter((o) => o !== opt) }));
  }

  async function handleAddField() {
    const trimmed = newFieldName.trim();
    if (!trimmed || !board) return;
    setAddingField(true);
    try {
      const base = slugify(trimmed) || `field_${fields.length + 1}`;
      const existingIds = new Set(fields.map((f) => f.id));
      let id = base;
      let n = 2;
      while (existingIds.has(id)) { id = `${base}_${n++}`; }
      const maxOrder = fields.reduce((acc, f) => Math.max(acc, f.displayOrder ?? 0), 0);
      const newField: FieldDef = {
        id,
        boardId: board.id,
        label: trimmed,
        type: newFieldType,
        visible: true,
        editable: true,
        searchable: newFieldType === "text" || newFieldType === "longtext" || newFieldType === "email",
        sortable: true,
        displayOrder: maxOrder + 1,
      };
      const saved = await provider.createField(newField);
      setFields([...fields, saved]);
      setNewFieldName("");
      setNewFieldType("text");
      if (SELECT_TYPES.includes(newFieldType)) {
        setExpandedFieldId(saved.id);
      }
      toast.success(`Campo "${saved.label}" adicionado`);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Erro ao adicionar campo");
    } finally {
      setAddingField(false);
    }
  }

  async function handleSave() {
    if (!board) return;
    if (!name.trim()) return;
    setLoading(true);
    try {
      const updatedBoard = {
        ...board,
        name: name.trim(),
        icon,
        description: description.trim() || undefined,
        groupBy: groupBy || board.groupBy,
      };
      const savedBoard = await provider.saveBoard(updatedBoard);
      setBoard(savedBoard);

      const updatedFields = [...fields];
      for (const [fieldId, options] of Object.entries(fieldOptionsMap)) {
        const field = fields.find((f) => f.id === fieldId);
        if (!field) continue;
        const savedField = await provider.saveField({ ...field, options });
        const idx = updatedFields.findIndex((f) => f.id === fieldId);
        if (idx >= 0) updatedFields[idx] = savedField;
      }
      if (Object.keys(fieldOptionsMap).length > 0) {
        setFields(updatedFields);
      }

      toast.success("Board atualizado");
      onClose();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Erro ao salvar board");
    } finally {
      setLoading(false);
    }
  }

  if (!board) return null;

  const NewFieldIcon = FIELD_TYPE_ICONS[newFieldType] ?? Type;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar board</DialogTitle>
          <DialogDescription>
            Atualize as configurações do board.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin space-y-6 mt-2 pr-1">
          {/* General settings */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Geral
            </h3>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                Ícone
              </label>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setIcon(e)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition
                      ${icon === e ? "bg-primary/15 ring-2 ring-primary" : "hover:bg-accent"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </section>

          {/* Group by field selector */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Columns3 className="h-3.5 w-3.5" />
              Agrupamento (colunas do board)
            </h3>

            {groupableFields.length === 0 ? (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                Nenhum campo de seleção criado. Adicione um campo do tipo Seleção, Chip ou Multi-seleção para habilitar o modo kanban.
              </p>
            ) : (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Campo de agrupamento</label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  <option value="">— sem agrupamento (lista) —</option>
                  {groupableFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  As opções do campo selecionado viram colunas do kanban. Edite as opções na lista de campos abaixo.
                </p>
              </div>
            )}
          </section>

          {/* Fields list with inline options editing */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Campos do board
            </h3>
            {fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum campo configurado.</p>
            ) : (
              <div className="space-y-1.5">
                {fields
                  .slice()
                  .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99))
                  .map((f) => {
                    const Icon = FIELD_TYPE_ICONS[f.type] ?? Type;
                    const isSelectable = SELECT_TYPES.includes(f.type);
                    const isExpanded = expandedFieldId === f.id;
                    const options = isSelectable ? getFieldOptions(f.id) : [];

                    return (
                      <div
                        key={f.id}
                        className="rounded-lg bg-surface border border-border overflow-hidden"
                      >
                        <div className="flex items-center gap-2.5 px-3 py-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm flex-1 truncate">{f.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                            {FIELD_TYPE_LABELS[f.type] ?? f.type}
                          </span>
                          {f.required && (
                            <span className="text-[10px] text-primary font-medium shrink-0">obrigatório</span>
                          )}
                          {isSelectable && (
                            <button
                              onClick={() => setExpandedFieldId(isExpanded ? null : f.id)}
                              className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition shrink-0"
                              aria-label={isExpanded ? "Ocultar opções" : "Editar opções"}
                            >
                              {isExpanded
                                ? <ChevronUp className="h-3.5 w-3.5" />
                                : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="px-3 pb-3 pt-2 border-t border-border space-y-2">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              Opções ({options.length})
                            </p>
                            {options.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nenhuma opção ainda.</p>
                            ) : (
                              <div className="space-y-1">
                                {options.map((opt) => (
                                  <div
                                    key={opt}
                                    className="flex items-center justify-between px-2 py-1 rounded bg-muted/40"
                                  >
                                    <span className="text-xs">{opt}</span>
                                    <button
                                      onClick={() => removeFieldOption(f.id, opt)}
                                      className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-danger transition"
                                      aria-label={`Remover opção ${opt}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <input
                                value={newOptionByField[f.id] ?? ""}
                                onChange={(e) =>
                                  setNewOptionByField((prev) => ({ ...prev, [f.id]: e.target.value }))
                                }
                                onKeyDown={(e) => e.key === "Enter" && addFieldOption(f.id)}
                                placeholder="Nova opção…"
                                className="flex-1 px-2 py-1 bg-surface border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
                              />
                              <button
                                onClick={() => addFieldOption(f.id)}
                                disabled={!(newOptionByField[f.id] ?? "").trim()}
                                className="px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-40"
                                aria-label="Adicionar opção"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddField()}
                placeholder="Nome do campo"
                className="flex-1 min-w-0 px-2.5 py-1.5 bg-surface border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <div className="relative">
                <NewFieldIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                  className="appearance-none pl-7 pr-6 py-1.5 bg-surface border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 cursor-pointer"
                >
                  {FIELD_TYPE_ORDER.map((type) => (
                    <option key={type} value={type}>{FIELD_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddField}
                disabled={!newFieldName.trim() || addingField}
                className="shrink-0 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                {addingField ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Adicionar
              </button>
            </div>
          </section>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t border-border mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || loading}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar alterações
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
