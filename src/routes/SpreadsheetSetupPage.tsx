import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  driveApiClient,
  sheetsApiClient,
  initProvider,
  getSheetProvider,
} from "@/shared/providers/providerFactory";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";
import { useAuthStore } from "@/store/authStore";
import { UserAccountMenu } from "@/components/UserAccountMenu";
import { Button } from "@/components/ui/button";

const FOLDER_NAME = "LealTEK Apps";
const SPREADSHEET_NAME = "MetaBoard";

export function SpreadsheetSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { setSpreadsheetId } = useSpreadsheetStore();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    findOrCreate(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function findOrCreate(email: string) {
    setError(null);
    try {
      const existing = await driveApiClient.findSpreadsheet(SPREADSHEET_NAME);

      let spreadsheetId: string;
      if (existing) {
        spreadsheetId = existing.id;
      } else {
        const { spreadsheetId: newId } = await sheetsApiClient.createSpreadsheet(SPREADSHEET_NAME);
        const folderId = await driveApiClient.getOrCreateFolder(FOLDER_NAME);
        await driveApiClient.moveToFolder(newId, folderId);
        spreadsheetId = newId;
      }

      initProvider(spreadsheetId);
      await getSheetProvider().initializeSpreadsheet?.();
      setSpreadsheetId(email, spreadsheetId);
      queryClient.clear();
      navigate("/boards");
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
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
            <span className="font-semibold truncate">
              {error ? "Erro de configuração" : "Configurando..."}
            </span>
          </nav>
        </div>
        <UserAccountMenu />
      </header>

      <div className="flex-1 flex items-center justify-center">
        {error ? (
          <div className="max-w-md text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-7 w-7 text-danger" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Não foi possível conectar</h2>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => user?.email && findOrCreate(user.email)} className="gap-2">
              <Loader2 className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Preparando sua planilha...</p>
          </div>
        )}
      </div>
    </div>
  );
}
