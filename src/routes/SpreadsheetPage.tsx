import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Loader2, AlertCircle } from "lucide-react";
import { useSpreadsheetStore } from "@/modules/project/store/spreadsheetStore";
import { getSheetProvider, isMockMode } from "@/shared/providers/providerFactory";
import type { BoardConfig } from "@/modules/project/domain/types";
import { CreateBoardModal } from "@/modules/project/ui/CreateBoardModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MOCK_CONNECTION_ID = "mock";
const MOCK_SHEET_ID = "mock";

export function SpreadsheetPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const { connections, touch } = useSpreadsheetStore();
  const [boards, setBoards] = useState<BoardConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const mock = isMockMode() || connectionId === MOCK_CONNECTION_ID;
  const connection = connections.find((c) => c.id === connectionId);
  const sheetId = mock ? MOCK_SHEET_ID : (connection?.sheetId ?? "");

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

  const title = mock ? "Boards de exemplo" : (connection?.name ?? "Planilha");

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px]" />
      </div>

      <header className="px-6 py-5 flex items-center gap-4 border-b border-border/50">
        <Link to="/" className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-base shadow-[var(--shadow-glow)]">
            📊
          </div>
          <span className="font-semibold">{title}</span>
        </div>
        {!mock && (
          <button
            onClick={() => setCreateOpen(true)}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-[var(--shadow-glow)] hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" />
            Novo board
          </button>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-16">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando boards…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-danger py-8">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-4xl mb-4">📋</div>
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
            onNew={() => setCreateOpen(true)}
          />
        )}
      </main>

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
  onNew,
}: {
  boards: BoardConfig[];
  connectionId: string;
  onNew: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Boards</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((b, i) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <button
              onClick={() => navigate(`/s/${connectionId}/b/${b.id}`)}
              className={cn(
                "w-full text-left p-5 rounded-2xl bg-card border border-border",
                "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)]",
                "transition-all group",
              )}
            >
              <div className="text-3xl mb-3">{b.icon}</div>
              <div className="font-semibold mb-1 group-hover:text-primary transition-colors">{b.name}</div>
              {b.description && <p className="text-sm text-muted-foreground line-clamp-2">{b.description}</p>}
            </button>
          </motion.div>
        ))}

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: boards.length * 0.05 }}
          onClick={onNew}
          className={cn(
            "text-left p-5 rounded-2xl border-2 border-dashed border-border",
            "hover:border-primary/40 hover:bg-primary/5 transition-all group",
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center mb-3 transition-colors">
            <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Novo board
          </div>
        </motion.button>
      </div>
    </div>
  );
}
