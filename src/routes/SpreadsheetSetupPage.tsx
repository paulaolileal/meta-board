import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Plus, FileSpreadsheet, ChevronRight, AlertCircle, Clock, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  driveApiClient,
  sheetsApiClient,
  initProvider,
  getSheetProvider,
} from "@/shared/providers/providerFactory";
import type { DriveFile } from "@/shared/api/DriveApiClient";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";
import { useAuthStore } from "@/store/authStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SpreadsheetSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { setSpreadsheetId } = useSpreadsheetStore();

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selecting, setSelecting] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("MetaBoard");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    driveApiClient
      .listSpreadsheets()
      .then(setFiles)
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  async function handleSelect(file: DriveFile) {
    if (!user?.email) return;
    setSelecting(file.id);
    try {
      initProvider(file.id);
      await getSheetProvider().initializeSpreadsheet?.();
      setSpreadsheetId(user.email, file.id);
      queryClient.clear();
      navigate("/boards");
    } catch (e) {
      toast.error(`Erro ao conectar à planilha: ${String((e as Error)?.message ?? e)}`);
      setSelecting(null);
    }
  }

  async function handleCreate() {
    if (!user?.email || !newName.trim()) return;
    setCreating(true);
    try {
      const { spreadsheetId } = await sheetsApiClient.createSpreadsheet(newName.trim());
      const folderId = await driveApiClient.getOrCreateFolder("LealTEK Apps");
      await driveApiClient.moveToFolder(spreadsheetId, folderId);
      initProvider(spreadsheetId);
      await getSheetProvider().initializeSpreadsheet?.();
      setSpreadsheetId(user.email, spreadsheetId);
      queryClient.clear();
      navigate("/boards");
    } catch (e) {
      toast.error(`Erro ao criar planilha: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative h-screen overflow-hidden flex flex-col bg-background">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px]" />
      </div>

      <header className="shrink-0 px-6 py-4 flex items-center gap-3 border-b border-border/50">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <img
            src="/logo-mb.png"
            alt="MetaBoard"
            className="h-7 w-7 object-contain rounded-lg shrink-0"
          />
          <nav className="flex items-center gap-1 text-sm min-w-0" aria-label="Breadcrumb">
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground transition whitespace-nowrap"
            >
              MetaBoard
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <span className="font-semibold truncate">Escolher planilha</span>
          </nav>
        </div>
        <a
          href="https://lealtek.com"
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-50 hover:opacity-80 transition-opacity shrink-0"
          title="Desenvolvido por LealTEK"
        >
          <img src="/lealtek-full.png" alt="LealTEK" className="h-10 object-contain" />
        </a>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin">
        <main className="max-w-2xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">Escolha sua planilha</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Conecte uma planilha Google Sheets existente ou crie uma nova.
            </p>
          </div>

          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar planilha..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setCreateOpen(true)} className="shrink-0 gap-2">
              <Plus className="h-4 w-4" />
              Nova planilha
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl skeleton" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-danger py-8">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <FileSpreadsheet className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground">
                {search ? "Nenhuma planilha encontrada." : "Você ainda não tem planilhas no Drive."}
              </p>
              {!search && (
                <Button
                  variant="outline"
                  className="mt-4 gap-2"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Criar primeira planilha
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((file, i) => (
                <motion.button
                  key={file.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleSelect(file)}
                  disabled={selecting !== null}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-accent/30 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    {selecting === file.id ? (
                      <Loader2 className="h-4 w-4 text-green-600 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      Modificado em {formatDate(file.modifiedTime)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </motion.button>
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova planilha</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium mb-1.5 block">Nome da planilha</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: MetaBoard"
              onKeyDown={(e) => e.key === "Enter" && !creating && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar e conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
