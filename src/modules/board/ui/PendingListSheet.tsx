import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useBoardStore } from "@/modules/board/store";
import { usePendingMutations } from "@/modules/board/usePendingMutations";
import { PendingItemRow } from "@/modules/board/ui/PendingItemRow";
import type { PendingItem } from "@/modules/project/domain/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onConvert: (item: PendingItem) => void;
}

export function PendingListSheet({ open, onClose, onConvert }: Props) {
  const pendingItems = useBoardStore((s) => s.pendingItems);
  const { toggleDone, clearCompleted } = usePendingMutations();

  const sortedItems = useMemo(
    () =>
      [...pendingItems].sort((a, b) => {
        if (a._done !== b._done) return a._done ? 1 : -1;
        return a._createdAt.localeCompare(b._createdAt);
      }),
    [pendingItems],
  );

  const hasCompleted = pendingItems.some((p) => p._done);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[80vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Pendentes</SheetTitle>
          <SheetDescription>
            Itens enviados por compartilhamento, aguardando virar um card.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          {sortedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum item pendente.</p>
          ) : (
            sortedItems.map((item) => (
              <PendingItemRow
                key={item._id}
                item={item}
                onToggleDone={toggleDone}
                onConvert={onConvert}
              />
            ))
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-border">
          <button
            onClick={() => clearCompleted()}
            disabled={!hasCompleted}
            className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-accent transition disabled:opacity-40 disabled:pointer-events-none"
          >
            Limpar concluídos
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
