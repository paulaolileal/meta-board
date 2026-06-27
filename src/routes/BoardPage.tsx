import { useState } from "react";
import { useParams } from "react-router-dom";
import { useBoardData } from "@/modules/board/useBoardData";
import { useBoardStore } from "@/modules/board/store";
import { Sidebar } from "@/modules/board/ui/Sidebar";
import { KanbanBoard } from "@/modules/board/ui/KanbanBoard";
import { EditBoardModal } from "@/modules/board/ui/EditBoardModal";
import { Loader2, Settings } from "lucide-react";

export function BoardPage() {
  const { connectionId, boardId } = useParams<{ connectionId: string; boardId: string }>();

  const { isLoading, isError, error } = useBoardData(connectionId!, boardId!);
  const hydrated = useBoardStore((s) => s.hydrated);
  const board = useBoardStore((s) => s.board);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden">
      <Sidebar connectionId={connectionId!} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-border flex items-center px-6 gap-3 glass">
          <div className="lg:hidden font-semibold">{board?.name ?? "MetaBoard"}</div>
          <div className="hidden lg:block font-semibold text-lg">{board?.name ?? "Quadro"}</div>
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
            <button
              onClick={() => setEditOpen(true)}
              className="ml-auto h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
              aria-label="Editar board"
              title="Editar board"
            >
              <Settings className="h-4 w-4" />
            </button>
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
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 p-6 h-full">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="w-[300px] shrink-0 rounded-2xl bg-surface/60 border border-border p-3">
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
