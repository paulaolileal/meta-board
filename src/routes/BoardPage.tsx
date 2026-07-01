import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useBoardData } from "@/modules/board/useBoardData";
import { useBoardStore } from "@/modules/board/store";
import { BoardTopBar } from "@/modules/board/ui/BoardTopBar";
import { KanbanBoard } from "@/modules/board/ui/KanbanBoard";
import { EditBoardModal } from "@/modules/board/ui/EditBoardModal";
import { AiCardModal } from "@/modules/board/ui/AiCardModal";
import { CreateCardModal } from "@/modules/board/ui/CreateCardModal";
import { CreateCardSpeedDial } from "@/modules/board/ui/CreateCardSpeedDial";

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { isLoading, isError, error } = useBoardData(boardId!);
  const hydrated = useBoardStore((s) => s.hydrated);
  const storeBoardId = useBoardStore((s) => s.boardId);
  const isReady = hydrated && storeBoardId === boardId;

  const [editOpen, setEditOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("edit") === "1" && hydrated) {
      setEditOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, hydrated]);

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      <BoardTopBar onOpenSettings={() => setEditOpen(true)} />

      <div className="flex-1 min-h-0 overflow-hidden relative">
        {!isReady ? (
          isError ? (
            <div className="p-8 text-danger">
              {String((error as Error)?.message ?? "Erro ao carregar board")}
            </div>
          ) : (
            <BoardSkeleton />
          )
        ) : (
          <KanbanBoard />
        )}

        <CreateCardSpeedDial
          onCreateCard={() => setCreateOpen(true)}
          onCreateAi={() => setAiOpen(true)}
        />
      </div>

      <EditBoardModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onDeleted={() => navigate("/boards")}
      />
      <AiCardModal open={aiOpen} onClose={() => setAiOpen(false)} />
      <CreateCardModal open={createOpen} onClose={() => setCreateOpen(false)} initialValues={{}} />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 p-4 sm:p-6 h-full">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="w-[260px] sm:w-[300px] shrink-0 rounded-2xl bg-surface/60 border border-border p-3"
        >
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
