import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserInfo } from "@/shared/auth/GoogleAuthService";

interface AuthState {
  user: UserInfo | null;
  isInitializing: boolean;
  setUser: (user: UserInfo) => void;
  clearUser: () => void;
  setInitializing: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isInitializing: true,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
      setInitializing: (v) => set({ isInitializing: v }),
    }),
    {
      name: "metaboard:auth",
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
