import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, AlertTriangle, Columns3, Tag, AlignLeft, Hash, ToggleLeft, Calendar, Link, Image, Smile, ListFilter, List, ListChecks, Mail, Palette, Type, CalendarClock } from "lucide-react";
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
  const cards = useBoardStore((s) => s.cards);
  const setBoard = useBoardStore((s) => s.setBoard);
  const setFields = useBoardStore((s) => s.setFields);
  const connectionId = useBoardStore((s) => s.connectionId);
  const connections = useSpreadsheetStore((s) => s.connections);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📋");
  const [description, setDescription] = useState("");
  const [groupBy, setGroupBy] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [newColumn, setNewColumn] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [addingField, setAddingField] = useState(false);

  const groupableFields = useMemo(
    () => fields.filter((f) => f.options && f.options.length > 0),
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
      const groupByField = fields.find((f) => f.id === board.groupBy);
      setColumns(groupByField?.options ?? []);
      setNewColumn("");
    }
  }, [open, board, fields]);

  function handleGroupByChange(fieldId: string) {
    setGroupBy(fieldId);
    const field = fields.find((f) => f.id === fieldId);
    setColumns(field?.options ?? []);
    setNewColumn("");
  }

  function cardsInColumn(col: string): number {
    const field = groupBy || board!.groupBy;
    return cards.filter((c) => !c._archived && c[field] === col).length;
  }

  function addColumn() {
    const trimmed = newColumn.trim();
    if (!trimmed || columns.includes(trimmed)) return;
    setColumns((prev) => [...prev, trimmed]);
    setNewColumn("");
  }

  function requestRemoveColumn(col: string) {
    setConfirmRemove(col);
  }

  function confirmRemoveColumn() {
    if (!confirmRemove) return;
    setColumns((prev) => prev.filter((c) => c !== confirmRemove));
    setConfirmRemove(null);
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

      const targetGroupBy = groupBy || board.groupBy;
      const groupByField = fields.find((f) => f.id === targetGroupBy);
      if (groupByField) {
        const updatedField = { ...groupByField, options: columns };
        const savedField = await provider.saveField(updatedField);
        setFields(fields.map((f) => (f.id === savedField.id ? savedField : f)));
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

  const activeGroupByField = fields.find((f) => f.id === (groupBy || board.groupBy));
  const NewFieldIcon = FIELD_TYPE_ICONS[newFieldType] ?? Type;
  const groupByLabel = activeGroupByField?.label ?? groupBy ?? board.groupBy;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Editar board</DialogTitle>
            <DialogDescription>
              Atualize as configurações e colunas do board.
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
                  Nenhum campo com opções definidas. Adicione campos do tipo Seleção, Chip ou Multi-seleção para criar colunas.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Campo de agrupamento</label>
                  <select
                    value={groupBy}
                    onChange={(e) => handleGroupByChange(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                  >
                    <option value="">— sem agrupamento (lista) —</option>
                    {groupableFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {/* Columns management (only shown when a groupBy field is selected) */}
            {groupBy && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Colunas ({groupByLabel})
                </h3>

                <div className="space-y-2">
                  {columns.map((col) => {
                    const count = cardsInColumn(col);
                    return (
                      <div
                        key={col}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface border border-border"
                      >
                        <span className="text-sm">{col}</span>
                        <div className="flex items-center gap-2">
                          {count > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {count} card{count !== 1 ? "s" : ""}
                            </span>
                          )}
                          <button
                            onClick={() => requestRemoveColumn(col)}
                            className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-danger hover:bg-danger/10 transition"
                            aria-label={`Remover coluna ${col}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <input
                    value={newColumn}
                    onChange={(e) => setNewColumn(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addColumn()}
                    placeholder="Nova coluna…"
                    className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  <button
                    onClick={addColumn}
                    disabled={!newColumn.trim() || columns.includes(newColumn.trim())}
                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-40"
                    aria-label="Adicionar coluna"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </section>
            )}

            {/* Existing fields */}
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
                      return (
                        <div
                          key={f.id}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface border border-border"
                        >
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm flex-1 truncate">{f.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                            {FIELD_TYPE_LABELS[f.type] ?? f.type}
                          </span>
                          {f.required && (
                            <span className="text-[10px] text-primary font-medium shrink-0">obrigatório</span>
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

      {/* Column removal confirmation */}
      <Dialog open={confirmRemove !== null} onOpenChange={(v) => !v && setConfirmRemove(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Remover coluna
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Ao remover a coluna <strong className="text-foreground">"{confirmRemove}"</strong>,
              os cards nesta coluna não serão deletados, mas ficarão sem coluna definida e podem
              desaparecer do quadro.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRemoveColumn}
                className="px-4 py-2 text-sm rounded-lg bg-danger text-danger-foreground font-medium hover:opacity-90 transition"
              >
                Remover coluna
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
