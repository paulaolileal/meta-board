import { createFileRoute } from "@tanstack/react-router";
import { useBoardData } from "@/modules/board/useBoardData";
import { useBoardStore } from "@/modules/board/store";
import { Sidebar } from "@/modules/board/ui/Sidebar";
import { KanbanBoard } from "@/modules/board/ui/KanbanBoard";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/board")({
  head: () => ({
    meta: [
      { title: "Quadro · MetaBoard" },
      { name: "description", content: "Visualize e edite seus cards em modo Kanban." },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const { isLoading, isError, error } = useBoardData();
  const hydrated = useBoardStore((s) => s.hydrated);
  const project = useBoardStore((s) => s.project);

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-border flex items-center px-6 gap-3 glass">
          <div className="lg:hidden font-semibold">{project?.name ?? "MetaBoard"}</div>
          <div className="hidden lg:block font-semibold text-lg">
            {project?.name ?? "Quadro"}
          </div>
          {project?.description && (
            <div className="hidden md:block text-sm text-muted-foreground truncate">
              · {project.description}
            </div>
          )}
          {isLoading && !hydrated && (
            <div className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> sincronizando…
            </div>
          )}
        </header>

        <div className="flex-1 min-h-0 overflow-hidden">
          {!hydrated && isLoading ? (
            <BoardSkeleton />
          ) : isError ? (
            <div className="p-8 text-danger">{String((error as Error)?.message ?? "Erro")}</div>
          ) : (
            <KanbanBoard />
          )}
        </div>
      </div>
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
