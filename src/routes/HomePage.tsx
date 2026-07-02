import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Table2, Kanban, Brain } from "lucide-react";
import { googleAuthService } from "@/shared/providers/providerFactory";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";

export function HomePage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const isAuthenticated = googleAuthService.isAuthenticated();

  useEffect(() => {
    if (googleAuthService.isAuthenticated() && !user) {
      googleAuthService.fetchUserInfo().then((info) => {
        if (info) setUser(info);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate("/boards", { replace: true });
    }
  }, [isInitializing, isAuthenticated, navigate]);

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

  if (isInitializing) return null;
  if (isAuthenticated) return null;

  return <LoginPage onSignIn={handleSignIn} isSigningIn={isSigningIn} />;
}

const FEATURES = [
  { icon: Table2, label: "Google Sheets", desc: "Sua planilha como fonte de dados" },
  { icon: Kanban, label: "Kanban nativo", desc: "Drag & drop entre colunas" },
  { icon: Brain, label: "IA integrada", desc: "Criação de cards com texto livre" },
];

function LoginPage({ onSignIn, isSigningIn }: { onSignIn: () => void; isSigningIn: boolean }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background flex flex-col lg:flex-row">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-primary-glow/6 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-1 flex flex-col justify-center px-8 lg:px-16 xl:px-24 py-16 lg:py-0"
      >
        <div className="flex items-center gap-3 mb-10">
          <img
            src="/logo-mb.png"
            alt="MetaBoard"
            className="h-12 w-12 object-contain rounded-2xl"
          />
          <div>
            <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase leading-none">
              lealtek
            </div>
            <div className="font-bold text-lg leading-tight">MetaBoard</div>
          </div>
        </div>

        <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
          Sua planilha,
          <br />
          <span className="text-primary">transformada</span>
          <br />
          em board.
        </h1>
        <p className="text-muted-foreground text-lg mb-12 max-w-md">
          Transforme qualquer Google Sheets em um quadro Kanban interativo — sem backend, sem
          código.
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
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {isSigningIn ? "Conectando…" : "Continuar com Google"}
          </button>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Seus dados permanecem na sua planilha Google Sheets.
          </p>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Ao continuar, você concorda com os{" "}
            <a
              href="https://lealtek.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a
              href="https://lealtek.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Política de Privacidade
            </a>
            .
          </p>

          <div className="flex justify-center mt-10">
            <a
              href="https://lealtek.com"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-40 hover:opacity-70 transition-opacity"
              title="Desenvolvido por LealTEK"
            >
              <img src="/lealtek-full.png" alt="LealTEK" className="h-12 object-contain" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
