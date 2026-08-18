import { Ban, CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBoardStore } from "@/modules/board/store";
import { extractUrlFromPendingItem } from "@/modules/board/pendingUrl";
import type {
  BatchItemResult,
  BatchProcessorStatus,
} from "@/modules/board/useBatchPendingProcessor";
import type { BoardConfig, CardRecord } from "@/modules/project/domain/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: BatchProcessorStatus;
  progress: { current: number; total: number };
  results: BatchItemResult[];
  stopReason?: string;
  onCancel: () => void;
  onOpenCard: (cardId: string) => void;
}

function getCardTitle(card: CardRecord, board: BoardConfig | null): string {
  const value = board ? card[board.cardTitleField] : undefined;
  return typeof value === "string" && value.trim() ? value : "Card sem título";
}

export function BatchProcessDialog({
  open,
  onOpenChange,
  status,
  progress,
  results,
  stopReason,
  onCancel,
  onOpenCard,
}: Props) {
  const board = useBoardStore((s) => s.board);
  const isRunning = status === "running";
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const rejectedCount = results.filter((r) => r.status === "rejected").length;
  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const summaryParts = [`${successCount} card(s) criado(s)`, `${errorCount} falha(s)`];
  if (rejectedCount > 0) {
    summaryParts.push(`${rejectedCount} rejeitado(s) por não ter relação com o board`);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !isRunning && onOpenChange(v)}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isRunning ? "Processando pendentes" : "Processamento concluído"}
          </DialogTitle>
          <DialogDescription>
            {isRunning
              ? "Abrindo cada link em segundo plano, extraindo os dados e criando os cards automaticamente."
              : `${summaryParts.join(", ")}.`}
          </DialogDescription>
        </DialogHeader>

        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {progress.current} de {progress.total}
              </span>
              <span>{percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {stopReason && <p className="text-sm text-amber-600 dark:text-amber-400">{stopReason}</p>}

        {results.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin border-t border-border pt-2">
            {[...results].reverse().map((r, i) => {
              const url = extractUrlFromPendingItem(r.item);
              return (
                <div key={`${r.item._id}-${i}`} className="flex items-start gap-2 py-1.5 text-xs">
                  {r.status === "success" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
                  ) : r.status === "rejected" ? (
                    <Ban className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    {r.status === "success" ? (
                      r.cards.map((card) => (
                        <button
                          key={card._id}
                          onClick={() => onOpenCard(card._id)}
                          className="block w-full truncate text-left text-primary hover:underline"
                        >
                          {getCardTitle(card, board)}
                        </button>
                      ))
                    ) : (
                      <p className="truncate text-foreground">{url || r.item.description}</p>
                    )}
                    {r.reason && <p className="text-muted-foreground">{r.reason}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          {isRunning ? (
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cancelar
            </button>
          ) : (
            <button
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition"
            >
              Fechar
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
