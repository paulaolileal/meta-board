import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useBoardData } from "@/modules/board/useBoardData";
import { useBoardStore } from "@/modules/board/store";
import { usePendingMutations } from "@/modules/board/usePendingMutations";
import { BoardTopBar } from "@/modules/board/ui/BoardTopBar";
import { KanbanBoard } from "@/modules/board/ui/KanbanBoard";
import { EditBoardModal } from "@/modules/board/ui/EditBoardModal";
import { AiCardModal } from "@/modules/board/ui/AiCardModal";
import { CreateCardModal } from "@/modules/board/ui/CreateCardModal";
import { CreateCardSpeedDial } from "@/modules/board/ui/CreateCardSpeedDial";
import { PendingListSheet } from "@/modules/board/ui/PendingListSheet";
import type { AiImportNavigationState } from "@/modules/board/ui/ExtensionImportGate";
import type { CardRecord, PendingItem } from "@/modules/project/domain/types";

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { isLoading, isError, error } = useBoardData(boardId!);
  const hydrated = useBoardStore((s) => s.hydrated);
  const storeBoardId = useBoardStore((s) => s.boardId);
  const board = useBoardStore((s) => s.board);
  const isReady = hydrated && storeBoardId === boardId;
  const { deletePendingItem } = usePendingMutations();

  const [editOpen, setEditOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [aiInitialText, setAiInitialText] = useState<string | undefined>(undefined);
  const [aiInitialVideoUrl, setAiInitialVideoUrl] = useState<string | undefined>(undefined);
  const [createInitialValues, setCreateInitialValues] = useState<Partial<CardRecord>>({});
  const [convertingItemId, setConvertingItemId] = useState<string | null>(null);

  function openCreateCard() {
    setCreateInitialValues({});
    setConvertingItemId(null);
    setCreateOpen(true);
  }

  function convertPendingItem(item: PendingItem) {
    setCreateInitialValues(board ? { [board.cardTitleField]: item.description } : {});
    setConvertingItemId(item._id);
    setPendingOpen(false);
    setCreateOpen(true);
  }

  function handleCardCreated(_card: CardRecord) {
    if (convertingItemId) {
      deletePendingItem(convertingItemId);
      setConvertingItemId(null);
    }
  }

  useEffect(() => {
    const state = location.state as AiImportNavigationState | null;
    if (!state?.aiImportText) return;

    setAiInitialText(state.aiImportText);
    setAiInitialVideoUrl(state.aiImportVideoUrl);
    setAiOpen(true);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    if (searchParams.get("edit") === "1" && hydrated) {
      setEditOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, hydrated]);

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      <BoardTopBar
        onOpenSettings={() => setEditOpen(true)}
        onOpenPending={() => setPendingOpen(true)}
      />

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

        <CreateCardSpeedDial onCreateCard={openCreateCard} onCreateAi={() => setAiOpen(true)} />
      </div>

      <EditBoardModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onDeleted={() => navigate("/boards")}
      />
      <AiCardModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        initialText={aiInitialText}
        initialVideoUrl={aiInitialVideoUrl}
      />
      <CreateCardModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialValues={createInitialValues}
        onCreated={handleCardCreated}
      />
      <PendingListSheet
        open={pendingOpen}
        onClose={() => setPendingOpen(false)}
        onConvert={convertPendingItem}
      />
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
