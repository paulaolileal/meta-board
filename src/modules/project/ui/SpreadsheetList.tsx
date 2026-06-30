import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MoreHorizontal, Trash2, ExternalLink, FileSpreadsheet } from "lucide-react";
import { useSpreadsheetStore } from "@/modules/project/store/spreadsheetStore";
import type { SpreadsheetConnection } from "@/modules/project/domain/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  connections: SpreadsheetConnection[];
}

export function SpreadsheetList({ connections }: Props) {
  const navigate = useNavigate();
  const removeConnection = useSpreadsheetStore((s) => s.removeConnection);

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {connections.map((conn, i) => (
        <SpreadsheetCard
          key={conn.id}
          connection={conn}
          index={i}
          onOpen={() => navigate(`/s/${conn.id}`)}
          onRemove={() => removeConnection(conn.id)}
        />
      ))}
    </div>
  );
}

function SpreadsheetCard({
  connection,
  index,
  onOpen,
  onRemove,
}: {
  connection: SpreadsheetConnection;
  index: number;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const lastAccess = (() => {
    try {
      return formatDistanceToNow(new Date(connection.lastAccessedAt), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return "nunca";
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "group relative p-5 rounded-2xl bg-card border border-border cursor-pointer",
        "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)]",
        "hover:border-primary/25 transition-all duration-200",
      )}
    >
      <button className="absolute inset-0 rounded-2xl" onClick={onOpen} aria-label={`Abrir ${connection.name}`} />

      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary-glow/20 flex items-center justify-center">
          <FileSpreadsheet className="h-5 w-5 text-primary/70" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "relative z-10 p-1.5 rounded-md text-muted-foreground",
                "opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground transition",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onOpen} className="cursor-pointer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onRemove}
              className="cursor-pointer text-danger focus:text-danger"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Desconectar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="font-semibold mb-1 group-hover:text-primary transition-colors truncate">
        {connection.name}
      </div>
      <div className="text-xs text-muted-foreground">Acessado {lastAccess}</div>
    </motion.div>
  );
}
