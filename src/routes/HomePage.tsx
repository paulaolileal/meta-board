import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Plus, LogIn, LogOut, Loader2 } from "lucide-react";
import { useSpreadsheetStore } from "@/modules/project/store/spreadsheetStore";
import { isMockMode, googleAuthService } from "@/shared/providers/providerFactory";
import type { SpreadsheetConnection } from "@/modules/project/domain/types";
import { SpreadsheetList } from "@/modules/project/ui/SpreadsheetList";
import { ConnectSheetModal } from "@/modules/project/ui/ConnectSheetModal";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MOCK_CONNECTION_ID = "mock";

export function HomePage() {
  const navigate = useNavigate();
  const { connections, addConnection } = useSpreadsheetStore();
  const [connectOpen, setConnectOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const mock = isMockMode();

  const isAuthenticated = !mock && googleAuthService.isAuthenticated();

  async function handleSignIn() {
    setIsSigningIn(true);
    try {
      await googleAuthService.signIn();
    } catch (e) {
      toast.error("Falha ao conectar com Google");
      console.error(e);
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleSignOut() {
    googleAuthService.signOut();
    toast.success("Desconectado do Google");
  }

  function handleOpenMock(boardId: string) {
    navigate(`/s/${MOCK_CONNECTION_ID}/b/${boardId}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-20 -left-20 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[500px] rounded-full bg-primary-glow/8 blur-[140px]" />
      </div>

      <header className="px-6 py-5 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-lg shadow-[var(--shadow-glow)]">
            ���
          </div>
          <span className="font-semibold text-lg">MetaBoard</span>
        </div>

        <div className="flex items-center gap-2">
          {!mock && (
            <>
              {isAuthenticated ? (
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium shadow-[var(--shadow-glow)] hover:opacity-90 transition",
                    isSigningIn && "opacity-70 cursor-not-allowed",
                  )}
                >
                  {isSigningIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  {isSigningIn ? "Conectando…" : "Entrar com Google"}
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {mock ? (
            <MockSection onOpen={handleOpenMock} />
          ) : (
            <ConnectedSection
              connections={connections}
              onConnect={() => setConnectOpen(true)}
            />
          )}
        </motion.div>
      </main>

      <ConnectSheetModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={(conn) => {
          addConnection(conn);
          navigate(`/s/${conn.id}`);
        }}
      />
    </div>
  );
}

function MockSection({ onOpen }: { onOpen: (boardId: string) => void }) {
  const mockBoards = [
    { id: "board-dev", name: "Dev Tracker", icon: "🚀", description: "Rastreamento de tarefas de desenvolvimento" },
    { id: "board-marketing", name: "Marketing", icon: "📣", description: "Campanhas e conteúdo" },
    { id: "board-produto", name: "Produto", icon: "✨", description: "Roadmap e features" },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-warning/15 text-warning-foreground border border-warning/30">
          <Sparkles className="h-3 w-3" />
          Modo desenvolvimento
        </span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mb-2">Boards de exemplo</h1>
      <p className="text-muted-foreground mb-8 max-w-xl">
        Para conectar planilhas reais, defina{" "}
        <code className="px-1.5 py-0.5 rounded bg-muted text-xs">VITE_GOOGLE_CLIENT_ID</code> no arquivo{" "}
        <code className="px-1.5 py-0.5 rounded bg-muted text-xs">.env.local</code>.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockBoards.map((b) => (
          <motion.button
            key={b.id}
            whileHover={{ y: -2 }}
            onClick={() => onOpen(b.id)}
            className="text-left p-5 rounded-2xl bg-card border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] transition-shadow"
          >
            <div className="text-3xl mb-3">{b.icon}</div>
            <div className="font-semibold mb-1">{b.name}</div>
            <p className="text-sm text-muted-foreground">{b.description}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function ConnectedSection({
  connections,
  onConnect,
}: {
  connections: SpreadsheetConnection[];
  onConnect: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Suas planilhas</h1>
          <p className="text-muted-foreground">Cada planilha pode conter vários boards.</p>
        </div>
        <button
          onClick={onConnect}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-[var(--shadow-glow)] hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" />
          Conectar planilha
        </button>
      </div>

      {connections.length === 0 ? (
        <EmptyConnections onConnect={onConnect} />
      ) : (
        <SpreadsheetList connections={connections} />
      )}
    </div>
  );
}

function EmptyConnections({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center text-4xl mb-4">
        📊
      </div>
      <h2 className="text-xl font-semibold mb-2">Nenhuma planilha conectada</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Conecte uma planilha Google Sheets existente ou crie uma nova para começar.
      </p>
      <button
        onClick={onConnect}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-[var(--shadow-glow)] hover:opacity-90 transition"
      >
        <Plus className="h-4 w-4" />
        Conectar planilha
      </button>
    </div>
  );
}
