import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getSheetProvider } from "@/shared/providers/providerFactory";
import type { BoardConfig, FieldDef } from "@/modules/project/domain/types";
import { DEFAULT_BOARD_FIELDS } from "@/shared/providers/GoogleSheetProvider";

interface Props {
  open: boolean;
  onClose: () => void;
  sheetId: string;
  onCreated: (board: BoardConfig) => void;
}

const EMOJIS = ["📋", "🚀", "✨", "📣", "🎯", "🛠️", "📊", "🔥", "💡", "🌟"];

export function CreateBoardModal({ open, onClose, sheetId, onCreated }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📋");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) { setError("Nome é obrigatório"); return; }
    setError("");
    setLoading(true);

    try {
      const provider = getSheetProvider(sheetId);

      if (!provider.createBoard) {
        throw new Error("Este provider não suporta criação de boards");
      }

      // Ensure spreadsheet structure exists
      if (provider.initializeSpreadsheet) {
        await provider.initializeSpreadsheet();
      }

      const fields: FieldDef[] = DEFAULT_BOARD_FIELDS.map((f) => ({
        ...f,
        boardId: "",
      }));

      const board = await provider.createBoard(
        {
          name: name.trim(),
          icon,
          description: description.trim() || undefined,
          groupBy: "status",
          orderBy: "_sort",
          cardTitleField: "title",
          cardDescriptionField: "description",
          cardClosedLayout: ["cover_image", "title", "status", "priority", "due_date", "checklist"],
          cardOpenLayout: "*",
        },
        fields,
      );

      onCreated(board);
      setName("");
      setDescription("");
      setIcon("📋");
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
            Cria um novo board nesta planilha com campos padrão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
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
