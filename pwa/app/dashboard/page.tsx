"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { VehicleCard } from "@/components/ui/VehicleCard";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import type { Vehicle } from "@/lib/types";
import useSWR from "swr";

export default function DashboardPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryString = useMemo(() => {
    const queryParams = new URLSearchParams();
    if (debouncedSearch) queryParams.set("search", debouncedSearch);
    if (statusFilter) queryParams.set("status", statusFilter);
    return queryParams.toString();
  }, [debouncedSearch, statusFilter]);

  const { data, isLoading, error } = useSWR<{ data: Vehicle[]; total_count: number }>(
    `/vehicles${queryString ? `?${queryString}` : ""}`,
    { refreshInterval: 30000 }
  );

  const vehicles = data?.data || [];

  const statuses = ["", "stored", "out", "maintenance", "transit"];

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-[#0e0d0b]">Vehicles</h1>

        {/* Search */}
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search vehicles..."
          className="w-full px-4 py-3 rounded-xl border border-[#0e0d0b]/10 bg-white text-[#0e0d0b] placeholder:text-[#0e0d0b]/30 focus:outline-none focus:ring-2 focus:ring-[#b8955a]/50 text-sm"
        />

        {/* Status filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-[#b8955a] text-[#faf9f7]"
                  : "bg-[#0e0d0b]/5 text-[#0e0d0b]/60"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        {/* Vehicle List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <VehicleCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-[#ef4444] text-sm">
            Failed to load vehicles
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-12 text-[#0e0d0b]/40 text-sm">
            No vehicles found
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onClick={() => router.push(`/vehicle/${vehicle.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
