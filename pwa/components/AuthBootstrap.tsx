"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app.store";

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const accessToken = useAppStore((s) => s.accessToken);

  useEffect(() => {
    if (accessToken) {
      setReady(true);
      return;
    }

    fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.access_token) {
          const store = useAppStore.getState();
          store.setAccessToken(data.access_token);
          if (data.user) {
            store.setUser(data.user);
          }
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
