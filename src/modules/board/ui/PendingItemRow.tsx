import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LayoutGrid } from "lucide-react";
import type { PendingItem } from "@/modules/project/domain/types";

const URL_PATTERN = /(https?:\/\/[^\s]+)/;

interface Props {
  item: PendingItem;
  onToggleDone: (id: string, done: boolean) => void;
  onConvert: (item: PendingItem) => void;
}

export function PendingItemRow({ item, onToggleDone, onConvert }: Props) {
  const urlMatch = item.description.match(URL_PATTERN);
  const url = urlMatch?.[0];

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <input
        type="checkbox"
        checked={item._done}
        onChange={(e) => onToggleDone(item._id, e.target.checked)}
        className="h-4 w-4 mt-1 shrink-0 accent-[var(--primary)]"
      />

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm whitespace-pre-wrap break-words ${
            item._done ? "line-through text-muted-foreground" : "text-foreground"
          }`}
        >
          {item.description}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(item._createdAt), { addSuffix: true, locale: ptBR })}
          </span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline truncate"
            >
              Abrir link
            </a>
          )}
        </div>
      </div>

      <button
        onClick={() => onConvert(item)}
        title="Converter em card"
        className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center border border-border hover:bg-accent transition"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
    </div>
  );
}
