import { useState } from "react";
import { Loader2, Link as LinkIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getSheetProvider } from "@/shared/providers/providerFactory";
import type { SpreadsheetConnection } from "@/modules/project/domain/types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: (conn: SpreadsheetConnection) => void;
}

function extractSheetId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export function ConnectSheetModal({ open, onClose, onConnected }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    setError("");
    const sheetId = extractSheetId(input);
    if (!sheetId) {
      setError("URL ou ID inválido. Cole a URL completa da planilha.");
      return;
    }

    setLoading(true);
    try {
      const provider = getSheetProvider(sheetId);
      const meta = await (provider as any).api?.getSpreadsheetMetadata?.(sheetId);
      const name = meta?.properties?.title ?? "Planilha sem título";

      const conn: SpreadsheetConnection = {
        id: crypto.randomUUID(),
        sheetId,
        name,
        connectedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      };

      onConnected(conn);
      setInput("");
      toast.success(`"${name}" conectada`);
    } catch (e) {
      const msg = (e as Error)?.message ?? "Erro desconhecido";
      setError(msg.includes("403") ? "Sem permissão. Certifique-se de que compartilhou a planilha com seu usuário Google." : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar planilha</DialogTitle>
          <DialogDescription>
            Cole a URL ou o ID da planilha Google Sheets que deseja usar como banco de dados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">URL ou ID da planilha</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full pl-9 pr-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
          </div>

          <div className="text-xs text-muted-foreground leading-relaxed">
            A planilha deve ter as abas <code className="px-1 bg-muted rounded">_boards</code>,{" "}
            <code className="px-1 bg-muted rounded">_fields</code> e{" "}
            <code className="px-1 bg-muted rounded">_cards</code>.{" "}
            Caso não existam, elas serão criadas automaticamente ao criar o primeiro board.
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleConnect}
              disabled={!input.trim() || loading}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Conectar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
