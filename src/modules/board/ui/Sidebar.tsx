import { useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Sparkles,
  Filter,
  Settings,
  Sun,
  Moon,
  Monitor,
  X,
  ChevronLeft,
  Columns3,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBoardStore } from "@/modules/board/store";
import { useThemeStore, type ThemeMode } from "@/modules/settings/themeStore";
import { getSheetProvider, isMockMode } from "@/shared/providers/providerFactory";
import { useSpreadsheetStore } from "@/modules/project/store/spreadsheetStore";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { FieldType } from "@/modules/project/domain/types";

const SELECT_TYPES: FieldType[] = ["select", "chip", "multiselect"];

interface Props {
  connectionId: string;
}

function SidebarContent({ connectionId }: Props) {
  const board = useBoardStore((s) => s.board);
  const cards = useBoardStore((s) => s.cards);
  const fields = useBoardStore((s) => s.fields);
  const search = useBoardStore((s) => s.search);
  const setSearch = useBoardStore((s) => s.setSearch);
  const setBoard = useBoardStore((s) => s.setBoard);
  const filterTags = useBoardStore((s) => s.filterTags);
  const toggleFilterTag = useBoardStore((s) => s.toggleFilterTag);
  const clearFilters = useBoardStore((s) => s.clearFilters);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const connections = useSpreadsheetStore((s) => s.connections);

  const sheetId = useMemo(
    () => connections.find((c) => c.id === connectionId)?.sheetId ?? "mock",
    [connections, connectionId],
  );

  const tagOptions = useMemo(
    () => fields.find((f) => f.id === "tags")?.options ?? [],
    [fields],
  );

  const groupableFields = useMemo(
    () => fields.filter((f) => SELECT_TYPES.includes(f.type)),
    [fields],
  );

  const isMock = isMockMode();
  const backTo = isMock ? "/" : `/s/${connectionId}`;

  const handleGroupByChange = useCallback(async (fieldId: string) => {
    if (!board) return;
    const updated = { ...board, groupBy: fieldId };
    setBoard(updated);
    const provider = getSheetProvider(sheetId);
    await provider.saveBoard(updated);
  }, [board, sheetId, setBoard]);

  return (
    <>
      <div className="p-4 border-b border-sidebar-border space-y-1">
        <Link
          to={backTo}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition w-fit"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {isMock ? "Início" : "Todos os boards"}
        </Link>
        <div className="flex items-center gap-2.5 mt-2">
          <img src="/logo-mb.png" alt="MetaBoard" className="w-9 h-9 object-contain rounded-xl shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase leading-none">lealtek</div>
            <div className="font-semibold truncate leading-tight mt-0.5">{board?.name ?? "MetaBoard"}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Sparkles className="h-3 w-3" />
              {isMock ? "Modo dev" : "Google Sheets"} · {cards.length} cards
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-auto scrollbar-thin">
        <div className="space-y-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cards…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ring/40 transition"
            />
          </div>
          {groupableFields.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Columns3 className="h-3.5 w-3.5" />
                Agrupar por
              </div>
              <Select value={board?.groupBy ?? ""} onValueChange={handleGroupByChange}>
                <SelectTrigger className="h-8 text-xs bg-surface border-border">
                  <SelectValue placeholder="— sem agrupamento —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— sem agrupamento —</SelectItem>
                  {groupableFields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {tagOptions.length > 0 && (
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
                      "px-2.5 py-1 rounded-md text-xs font-medium border transition",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-surface text-muted-foreground border-border hover:border-primary/40",
                    )}
                  >
                    #{t}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] text-muted-foreground">MetaBoard · planilha como banco de dados</div>
          <a
            href="https://lealtek.com"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-40 hover:opacity-70 transition-opacity"
            title="Desenvolvido por LealTEK"
          >
            <img src="/lealtek-full.png" alt="LealTEK" className="h-10 object-contain" />
          </a>
        </div>
      </div>
    </>
  );
}

export function Sidebar({ connectionId }: Props) {
  return (
    <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarContent connectionId={connectionId} />
    </aside>
  );
}

interface MobileSidebarProps extends Props {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ connectionId, open, onClose }: MobileSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="left"
        className="p-0 w-[280px] flex flex-col bg-sidebar text-sidebar-foreground border-sidebar-border [&>button:first-child]:hidden"
      >
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        <SidebarContent connectionId={connectionId} />
      </SheetContent>
    </Sheet>
  );
}
