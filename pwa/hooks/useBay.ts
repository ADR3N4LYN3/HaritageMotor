import useSWR from "swr";
import type { Bay } from "@/lib/types";

export function useBay(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Bay>(
    id ? `/bays/${id}` : null,
    { refreshInterval: 30000 }
  );
  return { bay: data, error, isLoading, mutate };
}

export function useBays() {
  const { data, error, isLoading } = useSWR<{ data: Bay[]; total_count: number }>(
    "/bays"
  );
  return { bays: data?.data || [], total: data?.total_count || 0, error, isLoading };
}
