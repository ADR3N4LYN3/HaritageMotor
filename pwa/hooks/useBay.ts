import useSWR from "swr";
import { api } from "@/lib/api";
import type { Bay } from "@/lib/types";

export function useBay(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Bay>(
    id ? `/bays/${id}` : null,
    (url: string) => api.get<Bay>(url)
  );
  return { bay: data, error, isLoading, mutate };
}

export function useBays() {
  const { data, error, isLoading } = useSWR(
    "/bays",
    (url: string) => api.get<{ data: Bay[]; total_count: number }>(url)
  );
  return { bays: data?.data || [], total: data?.total_count || 0, error, isLoading };
}
