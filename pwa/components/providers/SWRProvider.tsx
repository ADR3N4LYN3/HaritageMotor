"use client";

import { SWRConfig } from "swr";
import { api } from "@/lib/api";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: (url: string) => api.get(url),
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        focusThrottleInterval: 600000,
        errorRetryCount: 3,
        dedupingInterval: 5000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
