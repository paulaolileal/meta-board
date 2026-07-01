import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, AlertCircle, ChevronRight, LayoutGrid, Settings, Loader2 } from "lucide-react";
import { getSheetProvider, isMockMode, envSpreadsheetId } from "@/shared/providers/providerFactory";
import type { BoardConfig } from "@/modules/project/domain/types";
import { CreateBoardModal } from "@/modules/project/ui/CreateBoardModal";
import { BoardIconPicker } from "@/shared/icons/BoardIconPicker";
import { BoardColorPicker } from "@/shared/colors/BoardColorPicker";
import { getIcon } from "@/shared/icons/iconRegistry";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const MOCK_SHEET_ID = "mock";
const DEFAULT_BOARD_COLOR = "var(--primary)";

function nameFontClass(name: string): string {
  if (name.length <= 10) return "text-2xl";
  if (name.length <= 18) return "text-xl";
  return "text-lg";
}

export function SpreadsheetPage() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<BoardConfig | null>(null);

  const mock = isMockMode();
  const sheetId = mock ? MOCK_SHEET_ID : (envSpreadsheetId ?? "");

  useEffect(() => {
    const provider = getSheetProvider(sheetId);
    setLoading(true);
    setError(null);
    provider
      .loadBoards()
      .then(setBoards)
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [sheetId]);

  async function handleBoardCreated(board: BoardConfig) {
    setBoards((prev) => [...prev, board]);
    setCreateOpen(false);
    toast.success(`Board "${board.name}" criado`);
    navigate(`/boards/${board.id}`);
  }

  function handleBoardSaved(updated: BoardConfig) {
    setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  const title = mock ? "Boards de exemplo" : "Minha Planilha";

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px]" />
      </div>

      <header className="shrink-0 px-6 py-4 flex items-center gap-3 border-b border-border/50">
        <Link
          to="/"
          className="shrink-0 h-9 w-9 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition flex items-center justify-center"
          aria-label="Voltar ao início"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/logo-mb.png" alt="MetaBoard" className="h-7 w-7 object-contain rounded-lg shrink-0" />
          <nav className="flex items-center gap-1 text-sm min-w-0" aria-label="Breadcrumb">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition whitespace-nowrap">MetaBoard</Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <span className="font-semibold truncate">{title}</span>
          </nav>
        </div>
      </header>

      {/* Content area + FAB together in a relative container, same pattern as BoardPage */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <main className="max-w-6xl mx-auto px-6 py-10">
            {loading ? (
              <div>
                <div className="h-8 w-32 skeleton rounded mb-1" />
                <div className="h-4 w-16 skeleton rounded mb-8" />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-card)]">
                      <div className="flex">
                        <div className="shrink-0 w-28 skeleton" style={{ minHeight: "100px" }} />
                        <div className="flex-1 flex flex-col">
                          <div className="flex items-center px-4 py-5 bg-muted/40 flex-1">
                            <div className="skeleton h-5 w-3/4 rounded" />
                          </div>
                          <div className="flex items-start px-4 py-3 min-h-[52px]">
                            <div className="skeleton h-3.5 w-4/5 rounded" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-danger py-8">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            ) : boards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <LayoutGrid className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Nenhum board ainda</h2>
                <p className="text-muted-foreground mb-6">Crie o primeiro board nesta planilha.</p>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-[var(--shadow-glow)] hover:opacity-90 transition"
                >
                  <Plus className="h-4 w-4" />
                  Criar board
                </button>
              </div>
            ) : (
              <BoardGrid
                boards={boards}
                onEditBoard={setEditingBoard}
              />
            )}
          </main>
        </div>

        {!mock && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={() => setCreateOpen(true)}
            className="absolute bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow)] flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
            aria-label="Novo board"
          >
            <Plus className="h-6 w-6" />
          </motion.button>
        )}
      </div>

      {!mock && (
        <CreateBoardModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          sheetId={sheetId}
          onCreated={handleBoardCreated}
        />
      )}

      {editingBoard && (
        <QuickEditBoardModal
          board={editingBoard}
          sheetId={sheetId}
          onClose={() => setEditingBoard(null)}
          onSaved={handleBoardSaved}
        />
      )}
    </div>
  );
}

function BoardGrid({
  boards,
  onEditBoard,
}: {
  boards: BoardConfig[];
  onEditBoard: (board: BoardConfig) => void;
}) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Boards</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {boards.length} board{boards.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {boards.map((b, i) => {
          const effectiveColor = b.color || DEFAULT_BOARD_COLOR;
          const LucideIcon = getIcon(b.icon);

          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative group rounded-2xl overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] transition-all duration-200 border border-border hover:border-primary/20 bg-card"
            >
              {/* Main click area */}
              <button
                className="absolute inset-0 z-0"
                onClick={() => navigate(`/boards/${b.id}`)}
                aria-label={`Abrir ${b.name}`}
              />

              {/* Settings button */}
              <button
                className="absolute top-2 right-2 z-10 h-8 w-8 rounded-lg bg-black/20 hover:bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditBoard(b);
                }}
                aria-label={`Configurar ${b.name}`}
                title="Configurações do board"
              >
                <Settings className="h-4 w-4" />
              </button>

              <div className="flex">
                {/* Left strip: full-height colored with centered icon */}
                <div
                  className="shrink-0 w-28 flex items-center justify-center"
                  style={{ backgroundColor: effectiveColor }}
                >
                  {LucideIcon ? (
                    <LucideIcon size={56} className="text-white drop-shadow-sm" />
                  ) : (
                    <span className="text-[56px] leading-none">{b.icon}</span>
                  )}
                </div>

                {/* Right column */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div
                    className="flex items-center px-4 py-5"
                    style={{ backgroundColor: effectiveColor }}
                  >
                    <p className={cn("font-bold leading-snug text-white drop-shadow-sm line-clamp-2 group-hover:opacity-90 transition-opacity", nameFontClass(b.name))}>
                      {b.name}
                    </p>
                  </div>
                  <div className="flex-1 flex items-start px-4 py-3 min-h-[52px] relative">
                    <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundColor: effectiveColor }} />
                    <p className="relative text-sm text-muted-foreground line-clamp-2">
                      {b.description ?? ""}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

interface QuickEditProps {
  board: BoardConfig;
  sheetId: string;
  onClose: () => void;
  onSaved: (board: BoardConfig) => void;
}

function QuickEditBoardModal({ board, sheetId, onClose, onSaved }: QuickEditProps) {
  const [name, setName] = useState(board.name);
  const [icon, setIcon] = useState(board.icon);
  const [color, setColor] = useState(board.color ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const provider = getSheetProvider(sheetId);
      const updated = await provider.saveBoard({ ...board, name: name.trim(), icon, color: color || undefined });
      onSaved(updated);
      toast.success("Board atualizado");
      onClose();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Erro ao salvar board");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Configurar board</DialogTitle>
          <DialogDescription>Edite o nome, ícone e cor do board.</DialogDescription>
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
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>

          <div className="flex gap-2 justify-end">
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
              Salvar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
