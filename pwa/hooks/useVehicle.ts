import useSWR from "swr";
import type { Vehicle, Event } from "@/lib/types";

export function useVehicle(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Vehicle>(
    id ? `/vehicles/${id}` : null,
    { refreshInterval: 30000 }
  );
  return { vehicle: data, error, isLoading, mutate };
}

export function useVehicleTimeline(id: string) {
  const { data, error, isLoading, mutate } = useSWR<{ data: Event[]; total_count: number }>(
    id ? `/vehicles/${id}/timeline` : null,
    { refreshInterval: 30000 }
  );
  return { events: data?.data || [], total: data?.total_count || 0, error, isLoading, mutate };
}
