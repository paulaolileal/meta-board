import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { initProvider, getSheetProvider } from "@/shared/providers/providerFactory";
import { useAuthStore } from "@/store/authStore";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";
import { useBoardStore } from "@/modules/board/store";
import type { BoardConfig } from "@/modules/project/domain/types";
import { BoardPickerDialog } from "@/modules/board/ui/BoardPickerDialog";
import {
  SHARE_IMPORT_READY_EVENT,
  readPendingShareImport,
  clearPendingShareImport,
  combineShareText,
} from "@/modules/board/shareImport";

/**
 * Watches for content sent to the app via the Android Web Share Target
 * (from anywhere in the app) and prompts the user to pick a board, then adds
 * it straight to that board's pending-items list.
 */
export function PendingImportGate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const upsertPendingItem = useBoardStore((s) => s.upsertPendingItem);
  const user = useAuthStore((s) => s.user);
  const getSpreadsheetId = useSpreadsheetStore((s) => s.getSpreadsheetId);

  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<BoardConfig[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function checkPending() {
      if (readPendingShareImport()) setOpen(true);
    }
    checkPending();
    window.addEventListener(SHARE_IMPORT_READY_EVENT, checkPending);
    return () => window.removeEventListener(SHARE_IMPORT_READY_EVENT, checkPending);
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

  async function handleSelect(boardId: string) {
    const payload = readPendingShareImport();
    clearPendingShareImport();
    if (!payload) {
      setOpen(false);
      return;
    }

    // Keep the dialog open (with a spinner) until everything settles — the
    // write below can trigger an interactive token exchange, and closing the
    // dialog earlier would expose the not-yet-authenticated HomePage
    // underneath for that whole stretch.
    setSubmitting(true);
    const text = combineShareText(payload);
    if (text) {
      try {
        const item = await getSheetProvider().createPendingItem(boardId, text);
        // Board data is cached by React Query with a staleTime, so a board
        // visited moments ago would otherwise keep serving its pre-share
        // snapshot and never show this item. Update the live store directly
        // (if already on this board) and force a refetch for any other case.
        if (useBoardStore.getState().boardId === boardId) upsertPendingItem(item);
        await queryClient.invalidateQueries({ queryKey: ["board", boardId] });
        toast.success("Adicionado à lista de pendentes");
      } catch (e) {
        console.error(e);
        toast.error("Falha ao adicionar pendente");
      }
    }
    setSubmitting(false);
    setOpen(false);
    navigate(`/boards/${boardId}`);
  }

  function handleClose() {
    clearPendingShareImport();
    setOpen(false);
  }

  return (
    <BoardPickerDialog
      open={open}
      title="Enviar para qual board?"
      description="Escolha o board onde o item será adicionado à lista de pendentes."
      boards={boards}
      loading={loading || submitting}
      error={error}
      onSelect={handleSelect}
      onClose={handleClose}
    />
  );
}
