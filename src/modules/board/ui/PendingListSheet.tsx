import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useBoardStore } from "@/modules/board/store";
import { usePendingMutations } from "@/modules/board/usePendingMutations";
import { useBatchPendingProcessor } from "@/modules/board/useBatchPendingProcessor";
import { isExtensionAvailable } from "@/modules/board/extensionBridge";
import { extractUrlFromPendingItem } from "@/modules/board/pendingUrl";
import { PendingItemRow } from "@/modules/board/ui/PendingItemRow";
import { BatchProcessDialog } from "@/modules/board/ui/BatchProcessDialog";
import type { PendingItem } from "@/modules/project/domain/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onConvert: (item: PendingItem) => void;
}

export function PendingListSheet({ open, onClose, onConvert }: Props) {
  const pendingItems = useBoardStore((s) => s.pendingItems);
  const openCard = useBoardStore((s) => s.openCard);
  const { toggleDone, clearCompleted } = usePendingMutations();
  const batch = useBatchPendingProcessor();
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [extensionAvailable, setExtensionAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    isExtensionAvailable().then((available) => {
      if (!cancelled) setExtensionAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const sortedItems = useMemo(
    () =>
      [...pendingItems].sort((a, b) => {
        if (a._done !== b._done) return a._done ? 1 : -1;
        return a._createdAt.localeCompare(b._createdAt);
      }),
    [pendingItems],
  );

  const hasCompleted = pendingItems.some((p) => p._done);
  const processableItems = useMemo(
    () => pendingItems.filter((p) => !p._done && extractUrlFromPendingItem(p)),
    [pendingItems],
  );

  // Selection defaults to "everything processable", matching the previous
  // always-select-all behavior — but items the user deselects stay
  // deselected as the queue changes (e.g. a new pending item arrives), and
  // items that stop being processable (done, converted, deleted) are simply
  // dropped from the selection.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(processableItems.map((p) => p._id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of currentIds) {
        if (prev.has(id) || !knownIdsRef.current.has(id)) next.add(id);
      }
      return next;
    });
    knownIdsRef.current = currentIds;
  }, [processableItems]);

  const selectedCount = selectedIds.size;
  const canBatchProcess = !!extensionAvailable && selectedCount > 0;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleStartBatch() {
    setBatchDialogOpen(true);
    batch.start(Array.from(selectedIds));
  }

  function handleOpenCard(cardId: string) {
    setBatchDialogOpen(false);
    onClose();
    openCard(cardId);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="max-h-[80vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>Pendentes</SheetTitle>
            <SheetDescription>
              Itens enviados por compartilhamento, aguardando virar um card.
            </SheetDescription>
          </SheetHeader>

          {processableItems.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
              <span>
                {selectedCount} de {processableItems.length} selecionado(s) para processar
              </span>
              <button
                onClick={() =>
                  setSelectedIds(
                    selectedCount === processableItems.length
                      ? new Set()
                      : new Set(processableItems.map((p) => p._id)),
                  )
                }
                className="text-primary hover:underline"
              >
                {selectedCount === processableItems.length ? "Limpar seleção" : "Selecionar todos"}
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            {sortedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum item pendente.
              </p>
            ) : (
              sortedItems.map((item) => (
                <PendingItemRow
                  key={item._id}
                  item={item}
                  onToggleDone={toggleDone}
                  onConvert={onConvert}
                  selectable={!item._done && !!extractUrlFromPendingItem(item)}
                  selected={selectedIds.has(item._id)}
                  onToggleSelect={toggleSelect}
                />
              ))
            )}
          </div>

          <div className="flex justify-between items-center gap-2 pt-3 border-t border-border">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={!canBatchProcess}
                  title={
                    extensionAvailable === false
                      ? "Instale a extensão do Chrome para usar este recurso"
                      : undefined
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Processar automaticamente ({selectedCount})
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Processar {selectedCount} pendente(s)?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A extensão vai abrir cada link em segundo plano, extrair os dados e criar os
                    cards automaticamente. Os cards criados ficam marcados até você revisar e
                    aprovar cada um. Isso pode levar alguns minutos — você pode cancelar a qualquer
                    momento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleStartBatch}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={!hasCompleted}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-accent transition disabled:opacity-40 disabled:pointer-events-none"
                >
                  Limpar concluídos
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar concluídos?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os itens concluídos serão removidos permanentemente da lista de pendentes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearCompleted()}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SheetContent>
      </Sheet>

      <BatchProcessDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        status={batch.status}
        progress={batch.progress}
        results={batch.results}
        stopReason={batch.stopReason}
        onCancel={batch.cancel}
        onOpenCard={handleOpenCard}
      />
    </>
  );
}
