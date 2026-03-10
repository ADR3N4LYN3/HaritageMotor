"use client";

import useSWR from "swr";
import { useAppStore } from "@/store/app.store";

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const accessToken = useAppStore((s) => s.accessToken);

  const { isLoading } = useSWR(
    accessToken ? null : "auth-bootstrap",
    async () => {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      return res.ok ? res.json() : null;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      shouldRetryOnError: false,
      onSuccess: (data) => {
        if (data?.access_token) {
          const store = useAppStore.getState();
          store.setAccessToken(data.access_token);
          if (data.user) store.setUser(data.user);
        }
      },
    }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
