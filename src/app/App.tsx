import { useEffect, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { HomePage } from "@/routes/HomePage";
import { SpreadsheetPage } from "@/routes/SpreadsheetPage";
import { SpreadsheetSetupPage } from "@/routes/SpreadsheetSetupPage";
import { BoardPage } from "@/routes/BoardPage";
import { ExtensionInstructionsPage } from "@/routes/ExtensionInstructionsPage";
import { ShareTargetPage } from "@/routes/ShareTargetPage";
import { ExtensionImportGate } from "@/modules/board/ui/ExtensionImportGate";
import { PendingImportGate } from "@/modules/board/ui/PendingImportGate";
import { Link } from "react-router-dom";
import { googleAuthService, initProvider } from "@/shared/providers/providerFactory";
import { TOKEN_REQUEST_SUPERSEDED } from "@/shared/auth/GoogleAuthService";
import { useAuthStore } from "@/store/authStore";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";

function useAuthSync() {
  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const setInitializing = useAuthStore((s) => s.setInitializing);

  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key !== "metaboard:auth") return;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : null;
        if (!parsed?.state?.user) clearUser();
      } catch {
        clearUser();
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [clearUser]);

  useEffect(() => {
    if (!user) {
      setInitializing(false);
      return;
    }
    if (googleAuthService.isAuthenticated()) {
      setInitializing(false);
      return;
    }
    googleAuthService
      .silentSignIn()
      .catch((err) => {
        // A superseded request means another sign-in (e.g. the user picking
        // a board mid share-target flow) is now in flight and owns the
        // outcome — bail out without touching auth state so it can finish
        // uninterrupted. Only a real failure should sign the user out.
        if (err === TOKEN_REQUEST_SUPERSEDED) return;
        if (!googleAuthService.isAuthenticated()) {
          googleAuthService.signOut();
          clearUser();
        }
      })
      .finally(() => setInitializing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background silent refresh can still fail (e.g. third-party cookies
  // blocked, no reachable Google session) after exhausting its retries.
  // Surface a dismissible prompt instead of yanking the user back to login
  // mid-session — renewal only happens on an explicit tap, which is a real
  // user gesture and won't get blocked as an unsolicited popup.
  useEffect(() => {
    let toastId: string | number | undefined;
    googleAuthService.onReauthRequiredChange((required) => {
      if (!required) {
        if (toastId !== undefined) toast.dismiss(toastId);
        toastId = undefined;
        return;
      }
      toastId = toast.warning("Sua sessão com o Google expirou", {
        description: "Toque em Renovar para continuar sem perder o que você estava fazendo.",
        duration: Infinity,
        action: {
          label: "Renovar",
          onClick: () => {
            googleAuthService.signIn().catch(() => {
              toast.error("Não foi possível renovar a sessão. Tente novamente.");
            });
          },
        },
      });
    });
  }, []);
}

function AuthSplash() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  if (isInitializing) return <AuthSplash />;
  if (!user || !googleAuthService.isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function SpreadsheetRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const getSpreadsheetId = useSpreadsheetStore((s) => s.getSpreadsheetId);

  if (isInitializing) return <AuthSplash />;

  if (!user || !googleAuthService.isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const spreadsheetId = user.email ? getSpreadsheetId(user.email) : undefined;
  if (!spreadsheetId) {
    return <Navigate to="/setup" replace />;
  }

  initProvider(spreadsheetId);
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 text-primary hover:underline">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

export function AppRouter() {
  useAuthSync();

  return (
    <>
      <ExtensionImportGate />
      <PendingImportGate />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/share-target" element={<ShareTargetPage />} />
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <SpreadsheetSetupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/extension"
          element={
            <ProtectedRoute>
              <ExtensionInstructionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/boards"
          element={
            <SpreadsheetRoute>
              <SpreadsheetPage />
            </SpreadsheetRoute>
          }
        />
        <Route
          path="/boards/:boardId"
          element={
            <SpreadsheetRoute>
              <BoardPage />
            </SpreadsheetRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
