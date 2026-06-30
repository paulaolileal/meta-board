import { useState, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  Search,
  Columns3,
  Settings,
  Sun,
  Moon,
  Monitor,
  X,
  Filter,
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
import type { FieldType } from "@/modules/project/domain/types";

const SELECT_TYPES: FieldType[] = ["select", "chip", "multiselect"];
const THEME_CYCLE: ThemeMode[] = ["light", "auto", "dark"];
const THEME_ICONS = { light: Sun, auto: Monitor, dark: Moon } as const;
const THEME_LABELS = { light: "Claro", auto: "Auto", dark: "Escuro" } as const;

interface Props {
  connectionId: string;
  onOpenSettings: () => void;
}

export function BoardTopBar({ connectionId, onOpenSettings }: Props) {
  const board = useBoardStore((s) => s.board);
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

  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
  const hasActiveFilters = !!(search || filterTags.length > 0);
  const showSubRow = tagOptions.length > 0;

  const handleGroupByChange = useCallback(
    async (fieldId: string) => {
      if (!board) return;
      const updated = { ...board, groupBy: fieldId };
      setBoard(updated);
      const provider = getSheetProvider(sheetId);
      await provider.saveBoard(updated);
    },
    [board, sheetId, setBoard],
  );

  const cycleTheme = useCallback(() => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(mode) + 1) % THEME_CYCLE.length];
    setMode(next);
  }, [mode, setMode]);

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearch("");
  };

  const ThemeIcon = THEME_ICONS[mode];

  return (
    <div className="shrink-0 border-b border-border glass">
      {/* Main header row */}
      <div className="h-14 flex items-center px-3 md:px-4 gap-2">
        {searchOpen ? (
          <div className="flex-1 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cards…"
              className="w-full pl-9 pr-3 h-10 text-sm rounded-lg bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ring/40 transition"
            />
          </div>
        ) : (
          <>
            <Link
              to={backTo}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-foreground hover:bg-accent transition shrink-0"
              aria-label="Voltar"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <img
              src="/logo-mb.png"
              alt="MetaBoard"
              className="w-8 h-8 object-contain rounded-xl shrink-0"
            />
            <div className="min-w-0 flex-1 flex items-center gap-2">
              <div className="font-semibold text-sm md:text-base truncate leading-tight min-w-0 flex-1">
                {board?.name ?? "MetaBoard"}
              </div>
              {board?.description && (
                <div className="hidden md:block text-xs text-muted-foreground truncate leading-tight">
                  {board.description}
                </div>
              )}
              {/* Group by — inline on mobile, next to board name */}
              {groupableFields.length > 0 && (
                <div className="md:hidden shrink-0">
                  <Select value={board?.groupBy ?? ""} onValueChange={handleGroupByChange}>
                    <SelectTrigger className="h-7 text-xs bg-surface border-border gap-1 px-2 min-w-[100px]">
                      <Columns3 className="h-3 w-3 shrink-0" />
                      <SelectValue placeholder="Agrupar" />
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
          </>
        )}

        <div className="flex items-center gap-0.5 shrink-0">
          {/* Search toggle */}
          {searchOpen ? (
            <button
              onClick={closeSearch}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-foreground hover:bg-accent transition"
              aria-label="Fechar busca"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={openSearch}
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center transition",
                search
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent",
              )}
              aria-label="Buscar cards"
            >
              <Search className="h-4 w-4" />
            </button>
          )}

          {/* Group by — desktop only, shown inline in main row on mobile */}
          {groupableFields.length > 0 && (
            <div className="hidden md:block">
              <Select value={board?.groupBy ?? ""} onValueChange={handleGroupByChange}>
                <SelectTrigger
                  className={cn(
                    "h-9 w-9 border-0 bg-transparent rounded-lg p-0 flex items-center justify-center [&>svg.lucide-chevron-down]:hidden transition",
                    board?.groupBy
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "text-foreground hover:bg-accent",
                  )}
                  aria-label="Agrupar por"
                  title="Agrupar por"
                >
                  <Columns3 className="h-4 w-4" />
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

          {/* Theme cycle */}
          <button
            onClick={cycleTheme}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-foreground hover:bg-accent transition"
            aria-label={`Tema atual: ${THEME_LABELS[mode]}. Clique para alternar`}
            title={`Tema: ${THEME_LABELS[mode]}`}
          >
            <ThemeIcon className="h-4 w-4" />
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-foreground hover:bg-accent transition"
            aria-label="Configurações do board"
            title="Configurações do board"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Sub-row: tag filters */}
      {showSubRow && (
        <div className="flex items-center gap-2 px-3 md:px-4 py-2 border-t border-border">
          {/* Tag filters */}
          {tagOptions.length > 0 && (
            <>
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Filter className="h-3.5 w-3.5" />
                <span className="hidden sm:inline font-medium">Filtros</span>
              </div>
              <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-thin">
                {tagOptions.map((t) => {
                  const active = filterTags.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleFilterTag(t)}
                      className={cn(
                        "shrink-0 px-2.5 py-1 rounded-md text-xs font-medium border transition",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-surface text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="shrink-0 text-[11px] text-primary hover:underline flex items-center gap-0.5"
            >
              <X className="h-3 w-3" /> limpar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
