import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "@/routes/HomePage";
import { SpreadsheetPage } from "@/routes/SpreadsheetPage";
import { BoardPage } from "@/routes/BoardPage";
import { Link } from "react-router-dom";
import { isMockMode, googleAuthService } from "@/shared/providers/providerFactory";
import { useAuthStore } from "@/store/authStore";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!isMockMode() && (!user || !googleAuthService.isAuthenticated())) {
    return <Navigate to="/" replace />;
  }
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
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/s/:connectionId" element={<ProtectedRoute><SpreadsheetPage /></ProtectedRoute>} />
      <Route path="/s/:connectionId/b/:boardId" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
