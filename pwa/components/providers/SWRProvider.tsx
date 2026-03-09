"use client";

import { SWRConfig } from "swr";
import { api } from "@/lib/api";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: (url: string) => api.get(url),
        revalidateOnFocus: false,
        errorRetryCount: 3,
        dedupingInterval: 5000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
