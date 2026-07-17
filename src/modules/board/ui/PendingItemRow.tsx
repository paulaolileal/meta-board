import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, LayoutGrid, Undo2 } from "lucide-react";
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

      <div className="flex items-center gap-2 shrink-0">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              title={item._done ? "Reabrir item" : "Marcar como concluído"}
              className={`h-8 w-8 rounded-lg flex items-center justify-center border transition ${
                item._done
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent"
              }`}
            >
              {item._done ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {item._done ? "Reabrir item?" : "Marcar como concluído?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {item._done
                  ? "Este item voltará para a lista de pendentes."
                  : "Este item será marcado como concluído."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onToggleDone(item._id, !item._done)}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              title="Converter em card"
              className="h-8 w-8 rounded-lg flex items-center justify-center border border-border hover:bg-accent transition"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Converter em card?</AlertDialogTitle>
              <AlertDialogDescription>
                Um novo card será criado a partir deste item pendente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onConvert(item)}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
