import useSWR from "swr";
import { api } from "@/lib/api";
import type { Vehicle, Event } from "@/lib/types";

export function useVehicle(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Vehicle>(
    id ? `/vehicles/${id}` : null,
    (url: string) => api.get<Vehicle>(url)
  );
  return { vehicle: data, error, isLoading, mutate };
}

export function useVehicleTimeline(id: string) {
  const { data, error, isLoading } = useSWR(
    id ? `/vehicles/${id}/timeline` : null,
    (url: string) => api.get<{ data: Event[]; total_count: number }>(url)
  );
  return { events: data?.data || [], total: data?.total_count || 0, error, isLoading };
}
