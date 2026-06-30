import { useState } from "react";
import { useParams } from "react-router-dom";
import { useBoardData } from "@/modules/board/useBoardData";
import { useBoardStore } from "@/modules/board/store";
import { Sidebar, MobileSidebar } from "@/modules/board/ui/Sidebar";
import { KanbanBoard } from "@/modules/board/ui/KanbanBoard";
import { EditBoardModal } from "@/modules/board/ui/EditBoardModal";
import { AiCardModal } from "@/modules/board/ui/AiCardModal";
import { Loader2, Menu, Settings, Sparkles } from "lucide-react";

export function BoardPage() {
  const { connectionId, boardId } = useParams<{ connectionId: string; boardId: string }>();

  const { isLoading, isError, error } = useBoardData(connectionId!, boardId!);
  const hydrated = useBoardStore((s) => s.hydrated);
  const board = useBoardStore((s) => s.board);
  const [editOpen, setEditOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden">
      <Sidebar connectionId={connectionId!} />
      <MobileSidebar
        connectionId={connectionId!}
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-border flex items-center px-4 lg:px-6 gap-3 glass">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-semibold text-base lg:text-lg truncate min-w-0">
            {board?.name ?? "MetaBoard"}
          </div>
          {board?.description && (
            <div className="hidden md:block text-sm text-muted-foreground truncate">
              · {board.description}
            </div>
          )}
          {isLoading && !hydrated && (
            <div className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> sincronizando…
            </div>
          )}
          {board && (
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setAiOpen(true)}
                className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
                aria-label="Criar card com IA"
                title="Criar card com IA"
              >
                <Sparkles className="h-4 w-4" />
              </button>
              <button
                onClick={() => setEditOpen(true)}
                className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
                aria-label="Editar board"
                title="Editar board"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 min-h-0 overflow-hidden">
          {!hydrated && isLoading ? (
            <BoardSkeleton />
          ) : isError ? (
            <div className="p-8 text-danger">{String((error as Error)?.message ?? "Erro ao carregar board")}</div>
          ) : (
            <KanbanBoard />
          )}
        </div>
      </div>
      <EditBoardModal open={editOpen} onClose={() => setEditOpen(false)} />
      <AiCardModal open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 p-4 sm:p-6 h-full">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="w-[260px] sm:w-[300px] shrink-0 rounded-2xl bg-surface/60 border border-border p-3">
          <div className="h-4 w-24 rounded bg-muted animate-pulse mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-28 rounded-2xl bg-muted/60 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
