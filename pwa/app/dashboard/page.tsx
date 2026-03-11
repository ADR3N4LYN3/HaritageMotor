"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { VehicleCard } from "@/components/ui/VehicleCard";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useAppStore } from "@/store/app.store";
import { useReveal } from "@/hooks/useReveal";
import type { Vehicle } from "@/lib/types";
import useSWR from "swr";

export default function DashboardPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const canCreate = user?.role === "admin" || user?.role === "operator";
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const revealRef = useReveal();

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
  const totalCount = data?.total_count ?? 0;

  const handleVehicleClick = useCallback(
    (id: string) => router.push(`/vehicle/${id}`),
    [router]
  );

  const statuses = ["", "stored", "out", "maintenance", "transit"];
  const statusLabels: Record<string, string> = {
    "": "All",
    stored: "Stored",
    out: "Out",
    maintenance: "Maint.",
    transit: "Transit",
  };

  const storedCount = vehicles.filter((v) => v.status === "stored").length;
  const outCount = vehicles.filter((v) => v.status === "out").length;

  return (
    <AppShell>
      <div ref={revealRef} className="space-y-6">
        {/* Section tag */}
        <div className="reveal-up flex items-center justify-between">
          <div>
            <div className="section-tag mb-3">
              <span>Vehicle Registry</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-light tracking-wide text-white leading-tight">
              Your fleet
            </h1>
          </div>
          {canCreate && (
            <button
              onClick={() => router.push("/vehicle/new")}
              className="w-11 h-11 rounded-full border border-gold/40 bg-transparent flex items-center justify-center text-gold text-xl font-light hover:bg-gold hover:text-black transition-all duration-500 active:scale-95"
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
              aria-label="Add vehicle"
            >
              +
            </button>
          )}
        </div>

        {/* Stats band */}
        <div className="reveal-up reveal-d1">
          <div className="grid grid-cols-3 gap-px bg-white/[0.06] rounded-xl overflow-hidden border border-white/[0.06]">
            {[
              { value: totalCount, label: "Total", sub: "vehicles" },
              { value: storedCount, label: "Stored", sub: "in custody" },
              { value: outCount, label: "Out", sub: "with owners" },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-dark-2 p-4 md:p-5 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-gold/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <p className="text-2xl md:text-3xl font-display font-light text-white/90 tabular-nums">
                    {isLoading ? "-" : s.value}
                  </p>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-gold/70 mt-1 font-medium">
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gold separator */}
        <div className="reveal-up reveal-d2 gold-sep" />

        {/* Search */}
        <div className="reveal-up reveal-d2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by make, model, owner..."
            className="w-full px-4 py-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30 focus:bg-white/[0.05] focus:ring-1 focus:ring-gold/20 text-sm font-light tracking-wide transition-all duration-300"
            style={{ transitionTimingFunction: "var(--ease-lux)" }}
          />
        </div>

        {/* Status filter pills */}
        <div className="reveal-up reveal-d3 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs tracking-wider uppercase font-medium transition-all duration-300 border ${
                statusFilter === s
                  ? "bg-gold/15 text-gold border-gold/30"
                  : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/60 hover:border-white/[0.1]"
              }`}
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            >
              {statusLabels[s]}
            </button>
          ))}
        </div>

        {/* Vehicle List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <VehicleCardSkeleton key={n} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-danger/80 text-sm font-light">Failed to load vehicles</p>
            <p className="text-white/20 text-xs mt-1">Please try again later</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-16 reveal-up">
            <p className="font-display text-xl font-light text-white/30 italic">
              No vehicles found
            </p>
            <p className="text-white/15 text-xs mt-2 tracking-wider uppercase">
              {searchInput || statusFilter ? "Try adjusting your filters" : "Add your first vehicle to get started"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((vehicle, i) => (
              <div key={vehicle.id} className={`reveal-up reveal-d${Math.min(i + 1, 6)}`}>
                <VehicleCard
                  vehicle={vehicle}
                  onClick={handleVehicleClick}
                />
              </div>
            ))}
          </div>
        )}

        {/* Bottom count */}
        {!isLoading && vehicles.length > 0 && (
          <div className="reveal-up text-center pt-4 pb-2">
            <p className="text-[10px] tracking-[0.2em] uppercase text-white/20">
              {totalCount} vehicle{totalCount !== 1 ? "s" : ""} in registry
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
