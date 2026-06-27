import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  Sparkles,
  Filter,
  Settings,
  Sun,
  Moon,
  Monitor,
  X,
} from "lucide-react";
import { useBoardStore } from "@/modules/board/store";
import { useThemeStore, type ThemeMode } from "@/modules/settings/themeStore";
import { isMockMode } from "@/shared/providers/providerFactory";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const project = useBoardStore((s) => s.project);
  const cards = useBoardStore((s) => s.cards);
  const fields = useBoardStore((s) => s.fields);
  const search = useBoardStore((s) => s.search);
  const setSearch = useBoardStore((s) => s.setSearch);
  const filterTags = useBoardStore((s) => s.filterTags);
  const toggleFilterTag = useBoardStore((s) => s.toggleFilterTag);
  const clearFilters = useBoardStore((s) => s.clearFilters);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const tagOptions = useMemo(
    () => fields.find((f) => f.id === "tags")?.options ?? [],
    [fields]
  );

  return (
    <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="p-5 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-lg shadow-[var(--shadow-glow)]">
            {project?.icon ?? "✨"}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{project?.name ?? "MetaBoard"}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {isMockMode() ? "Modo mock" : "Google Sheets"} · {cards.length} cards
            </div>
          </div>
        </Link>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-auto scrollbar-thin">
        <div>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cards..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ring/40 transition"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Filter className="h-3.5 w-3.5" /> Filtros
            </div>
            {(search || filterTags.length > 0) && (
              <button
                onClick={clearFilters}
                className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
              >
                <X className="h-3 w-3" /> limpar
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tagOptions.map((t) => {
              const active = filterTags.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleFilterTag(t)}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[11px] font-medium border transition",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface text-muted-foreground border-border hover:border-primary/40"
                  )}
                >
                  #{t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            <Settings className="h-3.5 w-3.5" /> Tema
          </div>
          <div className="grid grid-cols-3 gap-1 p-1 bg-surface border border-border rounded-lg">
            {(
              [
                { v: "light", icon: Sun, label: "Claro" },
                { v: "auto", icon: Monitor, label: "Auto" },
                { v: "dark", icon: Moon, label: "Escuro" },
              ] as { v: ThemeMode; icon: typeof Sun; label: string }[]
            ).map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1.5 rounded-md text-[10px] font-medium transition",
                  mode === v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground leading-relaxed">
          MetaBoard v{project?.version ?? "1.0.0"} · planilha como banco de dados
        </div>
      </div>
    </aside>
  );
}
