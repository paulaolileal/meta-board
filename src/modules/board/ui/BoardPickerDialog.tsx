import { Loader2, Sparkles } from "lucide-react";
import type { BoardConfig } from "@/modules/project/domain/types";
import { getIcon } from "@/shared/icons/iconRegistry";

const DEFAULT_BOARD_COLOR = "var(--primary)";

interface Props {
  open: boolean;
  title: string;
  description: string;
  boards: BoardConfig[] | null;
  loading: boolean;
  error: string | null;
  onSelect: (boardId: string) => void;
  onClose: () => void;
}

/** Shared board-selection dialog used by both the extension-import and
 * share-target import flows to send captured content to a chosen board. */
export function BoardPickerDialog({
  open,
  title,
  description,
  boards,
  loading,
  error,
  onSelect,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center gap-2 px-6 pt-6 pb-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <h2 className="font-semibold text-base">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground px-6 pb-4">{description}</p>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-6 pb-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-danger py-4">{error}</p>
          ) : !boards || boards.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum board encontrado.</p>
          ) : (
            <div className="space-y-1.5">
              {boards.map((b) => {
                const effectiveColor = b.color || DEFAULT_BOARD_COLOR;
                const LucideIcon = getIcon(b.icon);

                return (
                  <button
                    key={b.id}
                    onClick={() => onSelect(b.id)}
                    className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-accent transition font-medium text-sm"
                  >
                    <span
                      className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: effectiveColor }}
                    >
                      {LucideIcon ? (
                        <LucideIcon size={18} className="text-white" />
                      ) : (
                        <span className="text-base leading-none">{b.icon}</span>
                      )}
                    </span>
                    <span className="truncate">{b.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
