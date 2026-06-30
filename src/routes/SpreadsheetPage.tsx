import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, AlertCircle, ChevronRight, LayoutGrid } from "lucide-react";
import { useSpreadsheetStore } from "@/modules/project/store/spreadsheetStore";
import { getSheetProvider, isMockMode, envSpreadsheetId } from "@/shared/providers/providerFactory";
import { ENV_CONNECTION_ID } from "@/routes/HomePage";
import type { BoardConfig } from "@/modules/project/domain/types";
import { CreateBoardModal } from "@/modules/project/ui/CreateBoardModal";
import { getIcon } from "@/shared/icons/iconRegistry";
import { toast } from "sonner";

const MOCK_CONNECTION_ID = "mock";
const MOCK_SHEET_ID = "mock";
const DEFAULT_BOARD_COLOR = "var(--primary)";

export function SpreadsheetPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const { connections, touch } = useSpreadsheetStore();
  const [boards, setBoards] = useState<BoardConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const mock = isMockMode() || connectionId === MOCK_CONNECTION_ID;
  const isEnvConnection = connectionId === ENV_CONNECTION_ID;
  const connection = connections.find((c) => c.id === connectionId);
  const sheetId = mock
    ? MOCK_SHEET_ID
    : isEnvConnection
      ? (envSpreadsheetId ?? "")
      : (connection?.sheetId ?? "");

  useEffect(() => {
    if (!connectionId) return;
    const provider = getSheetProvider(sheetId);
    setLoading(true);
    setError(null);
    provider
      .loadBoards()
      .then((b) => {
        setBoards(b);
        if (connection) touch(connection.id);
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [connectionId, sheetId]);

  async function handleBoardCreated(board: BoardConfig) {
    setBoards((prev) => [...prev, board]);
    setCreateOpen(false);
    toast.success(`Board "${board.name}" criado`);
    navigate(`/s/${connectionId}/b/${board.id}`);
  }

  const title = mock
    ? "Boards de exemplo"
    : isEnvConnection
      ? "Minha Planilha"
      : (connection?.name ?? "Planilha");

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px]" />
      </div>

      <header className="px-6 py-4 flex items-center gap-3 border-b border-border/50">
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

      <main className="max-w-6xl mx-auto px-6 py-10">
        {loading ? (
          <div>
            <div className="h-8 w-32 skeleton rounded mb-1" />
            <div className="h-4 w-16 skeleton rounded mb-8" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-card)]">
                  <div className="h-14 skeleton rounded-none" />
                  <div className="pt-8 pb-5 px-5">
                    <div className="skeleton h-5 w-3/5 rounded mb-3" />
                    <div className="skeleton h-3.5 w-4/5 rounded" />
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
            connectionId={connectionId!}
          />
        )}
      </main>

      {!mock && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow)] flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
          aria-label="Novo board"
        >
          <Plus className="h-6 w-6" />
        </motion.button>
      )}

      {!mock && (
        <CreateBoardModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          sheetId={sheetId}
          onCreated={handleBoardCreated}
        />
      )}
    </div>
  );
}

function BoardGrid({
  boards,
  connectionId,
}: {
  boards: BoardConfig[];
  connectionId: string;
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
            >
              <button
                onClick={() => navigate(`/s/${connectionId}/b/${b.id}`)}
                className="w-full text-left rounded-2xl bg-card border border-border cursor-pointer overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] hover:border-primary/20 transition-all duration-200 group"
              >
                {/* Colored header zone */}
                <div className="h-14 relative" style={{ backgroundColor: effectiveColor }}>
                  <div className="absolute bottom-0 left-5 translate-y-1/2">
                    <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center shadow-sm ring-1 ring-black/5">
                      {LucideIcon ? (
                        <LucideIcon size={24} style={{ color: effectiveColor }} />
                      ) : (
                        <span className="text-2xl leading-none">{b.icon}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="pt-8 pb-5 px-5">
                  <div className="font-semibold text-base leading-tight group-hover:text-primary transition-colors">
                    {b.name}
                  </div>
                  {b.description && (
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                      {b.description}
                    </p>
                  )}
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
