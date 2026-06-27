import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Layers, Zap, Lock } from "lucide-react";
import { isMockMode } from "@/shared/providers/providerFactory";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MetaBoard — Sua planilha como aplicação de cards" },
      {
        name: "description",
        content:
          "Transforme uma planilha Google Sheets em um quadro Kanban moderno, configurável e sem backend próprio.",
      },
      { property: "og:title", content: "MetaBoard — Planilha como aplicação" },
      {
        property: "og:description",
        content: "Quadros, listas e cards interpretados a partir do seu Google Sheets.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const mock = isMockMode();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 -left-20 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-primary-glow/10 blur-[140px]" />
      </div>

      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-lg shadow-[var(--shadow-glow)]">
            🚀
          </div>
          <span className="font-semibold text-lg">MetaBoard</span>
        </div>
        <a
          href="https://github.com"
          className="text-sm text-muted-foreground hover:text-foreground transition"
        >
          docs
        </a>
      </header>

      <main className="px-6 pt-12 pb-24 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-6"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="h-3 w-3" />
            sua planilha como banco de dados
          </span>
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight">
            Quadros, listas e cards
            <br />
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              direto do Google Sheets
            </span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            O MetaBoard interpreta a estrutura da sua planilha e renderiza uma aplicação de gestão
            moderna — sem backend próprio, com cache local e sincronização em segundo plano.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <button
              onClick={() => navigate({ to: "/board" })}
              className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium shadow-[var(--shadow-glow)] hover:opacity-95 transition"
            >
              Entrar em modo demo
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition" />
            </button>
            <button
              disabled={mock}
              title={mock ? "Defina VITE_GOOGLE_CLIENT_ID e VITE_GOOGLE_SHEET_ID" : ""}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface border border-border font-medium hover:border-primary/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Lock className="h-4 w-4" />
              Conectar Google
            </button>
          </div>
          {mock && (
            <p className="text-xs text-muted-foreground pt-1">
              Modo mock ativo. Para conectar uma planilha real, defina{" "}
              <code className="px-1 py-0.5 rounded bg-muted">VITE_GOOGLE_CLIENT_ID</code> e{" "}
              <code className="px-1 py-0.5 rounded bg-muted">VITE_GOOGLE_SHEET_ID</code>.
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="grid sm:grid-cols-3 gap-4 mt-20"
        >
          {[
            {
              icon: Layers,
              title: "Schema dinâmico",
              text: "Defina campos na aba _fields e a UI se reorganiza automaticamente.",
            },
            {
              icon: Zap,
              title: "Cache em 3 camadas",
              text: "Memória, IndexedDB e Sheets. Optimistic updates e debounce de escrita.",
            },
            {
              icon: Sparkles,
              title: "Visual premium",
              text: "Drag and drop, glass, animações, tema claro/escuro automático.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-2xl bg-card border border-border shadow-[var(--shadow-card)]"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <f.icon className="h-4 w-4" />
              </div>
              <div className="font-semibold mb-1">{f.title}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.text}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
