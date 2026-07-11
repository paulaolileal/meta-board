import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { initProvider, getSheetProvider } from "@/shared/providers/providerFactory";
import { useAuthStore } from "@/store/authStore";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";
import type { BoardConfig } from "@/modules/project/domain/types";
import {
  EXTENSION_IMPORT_READY_EVENT,
  readPendingExtensionImport,
  clearPendingExtensionImport,
  formatExtensionImportAsText,
} from "@/modules/board/extensionImport";

export interface AiImportNavigationState {
  aiImportText: string;
  aiImportVideoUrl?: string;
}

/**
 * Watches for a post captured by the Chrome extension (from anywhere in the
 * app) and prompts the user to pick a board before opening the AI card
 * modal on that board's page.
 */
export function ExtensionImportGate() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const getSpreadsheetId = useSpreadsheetStore((s) => s.getSpreadsheetId);

  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<BoardConfig[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function checkPending() {
      if (readPendingExtensionImport()) setOpen(true);
    }
    checkPending();
    window.addEventListener(EXTENSION_IMPORT_READY_EVENT, checkPending);
    return () => window.removeEventListener(EXTENSION_IMPORT_READY_EVENT, checkPending);
  }, []);

  useEffect(() => {
    if (!open) return;

    const spreadsheetId = user?.email ? getSpreadsheetId(user.email) : undefined;
    if (!spreadsheetId) {
      // App isn't set up yet (login/spreadsheet setup pending) — nothing to pick from.
      setOpen(false);
      return;
    }

    initProvider(spreadsheetId);
    setLoading(true);
    setError(null);
    getSheetProvider()
      .loadBoards()
      .then(setBoards)
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSelect(boardId: string) {
    const payload = readPendingExtensionImport();
    clearPendingExtensionImport();
    setOpen(false);
    if (!payload) return;

    const state: AiImportNavigationState = {
      aiImportText: formatExtensionImportAsText(payload),
      aiImportVideoUrl: payload.videoUrl,
    };
    navigate(`/boards/${boardId}`, { state });
  }

  function handleClose() {
    clearPendingExtensionImport();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center gap-2 px-6 pt-6 pb-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <h2 className="font-semibold text-base">Enviar para qual board?</h2>
        </div>
        <p className="text-sm text-muted-foreground px-6 pb-4">
          Escolha o board onde o card extraído do Instagram será criado.
        </p>

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
              {boards.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSelect(b.id)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-accent transition font-medium text-sm"
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
