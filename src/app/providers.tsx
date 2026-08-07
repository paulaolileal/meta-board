import type { ReactNode } from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { GoogleAuthError } from "@/shared/auth/GoogleAuthService";
import { googleAuthService } from "@/shared/providers/providerFactory";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
  // Catches a session expiry surfacing from a background refetch (e.g. the
  // window-focus refetch above) — mutations already handle GoogleAuthError
  // locally, but a query has nowhere else to report it. Reuses the same
  // deduped reconnect prompt the proactive refresh scheduler shows.
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof GoogleAuthError) googleAuthService.notifyReauthRequired();
    },
  }),
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
