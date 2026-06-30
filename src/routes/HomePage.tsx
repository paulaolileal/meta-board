import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Plus, LogOut, Loader2, Table2, Kanban, Brain, Rocket, Megaphone, FileSpreadsheet } from "lucide-react";
import { useSpreadsheetStore } from "@/modules/project/store/spreadsheetStore";
import { isMockMode, googleAuthService, envSpreadsheetId } from "@/shared/providers/providerFactory";
import type { SpreadsheetConnection } from "@/modules/project/domain/types";
import { SpreadsheetList } from "@/modules/project/ui/SpreadsheetList";
import { ConnectSheetModal } from "@/modules/project/ui/ConnectSheetModal";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";

const MOCK_CONNECTION_ID = "mock";
export const ENV_CONNECTION_ID = "env";

export function HomePage() {
  const navigate = useNavigate();
  const { connections, addConnection } = useSpreadsheetStore();
  const { user, setUser, clearUser } = useAuthStore();
  const [connectOpen, setConnectOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const mock = isMockMode();
  const isAuthenticated = mock || googleAuthService.isAuthenticated();

  // Silent recovery: token still valid in sessionStorage but user info not in store
  useEffect(() => {
    if (!mock && googleAuthService.isAuthenticated() && !user) {
      googleAuthService.fetchUserInfo().then((info) => {
        if (info) setUser(info);
      });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && envSpreadsheetId) {
      navigate(`/s/${ENV_CONNECTION_ID}`, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleSignIn() {
    setIsSigningIn(true);
    try {
      await googleAuthService.signIn();
      const info = await googleAuthService.fetchUserInfo();
      if (info) setUser(info);
    } catch (e) {
      toast.error("Falha ao conectar com Google");
      console.error(e);
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleSignOut() {
    googleAuthService.signOut();
    clearUser();
    toast.success("Desconectado do Google");
  }

  function handleOpenMock(boardId: string) {
    navigate(`/s/${MOCK_CONNECTION_ID}/b/${boardId}`);
  }

  if (!mock && !isAuthenticated) {
    return <LoginPage onSignIn={handleSignIn} isSigningIn={isSigningIn} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-20 -left-20 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[500px] rounded-full bg-primary-glow/8 blur-[140px]" />
      </div>

      <header className="px-6 py-5 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <img src="/logo-mb.png" alt="MetaBoard" className="h-9 w-9 object-contain rounded-xl" />
          <div>
            <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase leading-none">lealtek</div>
            <div className="font-semibold text-sm leading-tight">MetaBoard</div>
          </div>
        </div>

        {!mock && (
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                {user.picture && (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-7 h-7 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span className="text-sm text-muted-foreground hidden sm:block">{user.name}</span>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        )}
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

const FEATURES = [
  { icon: Table2, label: "Google Sheets", desc: "Sua planilha como fonte de dados" },
  { icon: Kanban, label: "Kanban nativo", desc: "Drag & drop entre colunas" },
  { icon: Brain, label: "IA integrada", desc: "Criação de cards com texto livre" },
];

function LoginPage({ onSignIn, isSigningIn }: { onSignIn: () => void; isSigningIn: boolean }) {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-primary-glow/6 blur-[120px]" />
      </div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-1 flex flex-col justify-center px-8 lg:px-16 xl:px-24 py-16 lg:py-0"
      >
        <div className="flex items-center gap-3 mb-10">
          <img src="/logo-mb.png" alt="MetaBoard" className="h-12 w-12 object-contain rounded-2xl" />
          <div>
            <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase leading-none">lealtek</div>
            <div className="font-bold text-lg leading-tight">MetaBoard</div>
          </div>
        </div>

        <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
          Sua planilha,<br />
          <span className="text-primary">transformada</span><br />
          em board.
        </h1>
        <p className="text-muted-foreground text-lg mb-12 max-w-md">
          Transforme qualquer Google Sheets em um quadro Kanban interativo — sem backend, sem código.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Painel de login */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="lg:w-[420px] xl:w-[460px] flex flex-col justify-center px-8 lg:px-12 py-16 lg:py-0 lg:border-l border-border"
      >
        <div className="w-full max-w-sm mx-auto lg:max-w-none">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Boas-vindas</h2>
          <p className="text-muted-foreground text-sm mb-8">
            Faça login com sua conta Google para acessar suas planilhas.
          </p>

          <button
            onClick={onSignIn}
            disabled={isSigningIn}
            className={cn(
              "w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl",
              "bg-primary text-primary-foreground font-semibold text-sm",
              "shadow-[var(--shadow-glow)] hover:opacity-90 active:scale-[0.98] transition-all duration-150",
              isSigningIn && "opacity-70 cursor-not-allowed",
            )}
          >
            {isSigningIn ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            {isSigningIn ? "Conectando…" : "Continuar com Google"}
          </button>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Seus dados permanecem na sua planilha Google Sheets.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

const MOCK_BOARD_ICONS: Record<string, React.ElementType> = {
  "board-dev": Rocket,
  "board-marketing": Megaphone,
  "board-produto": Sparkles,
};

function MockSection({ onOpen }: { onOpen: (boardId: string) => void }) {
  const mockBoards = [
    { id: "board-dev", name: "Dev Tracker", description: "Rastreamento de tarefas de desenvolvimento" },
    { id: "board-marketing", name: "Marketing", description: "Campanhas e conteúdo" },
    { id: "board-produto", name: "Produto", description: "Roadmap e features" },
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
        {mockBoards.map((b) => {
          const Icon = MOCK_BOARD_ICONS[b.id];
          return (
            <motion.button
              key={b.id}
              whileHover={{ y: -2 }}
              onClick={() => onOpen(b.id)}
              className="text-left p-5 rounded-2xl bg-card border border-border cursor-pointer shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] hover:border-primary/20 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary-glow/20 flex items-center justify-center mb-4">
                {Icon && <Icon className="h-5 w-5 text-primary/70" />}
              </div>
              <div className="font-semibold mb-1">{b.name}</div>
              <p className="text-sm text-muted-foreground">{b.description}</p>
            </motion.button>
          );
        })}
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
      <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40" />
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
