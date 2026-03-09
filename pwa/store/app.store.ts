import { create } from "zustand";
import type { User } from "@/lib/types";

interface AppState {
  // Auth
  accessToken: string | null;
  user: User | null;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;

  // Offline
  pendingCount: number;
  setPendingCount: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  accessToken: null,
  user: null,
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  logout: () => set({ accessToken: null, user: null }),

  pendingCount: 0,
  setPendingCount: (count) => set({ pendingCount: count }),
}));
