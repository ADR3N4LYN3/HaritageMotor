"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { VehicleCard } from "@/components/ui/VehicleCard";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useAppStore } from "@/store/app.store";
import { useI18n } from "@/lib/i18n";
import { dashboardI18n } from "@/lib/translations";
import useSWR from "swr";
import type { Vehicle } from "@/lib/types";

export default function VehiclesPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const canCreate = user?.role === "admin" || user?.role === "operator";
  const { t } = useI18n(dashboardI18n);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", String(page));
    params.set("per_page", String(PER_PAGE));
    return params.toString();
  }, [debouncedSearch, statusFilter, page]);

  const { data, isLoading, error } = useSWR<{ data: Vehicle[]; total_count: number }>(
    `/vehicles?${queryString}`,
    { refreshInterval: 30000 }
  );

  const vehicles = data?.data || [];
  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  const handleVehicleClick = useCallback(
    (id: string) => router.push(`/vehicle/${id}`),
    [router]
  );

  const statuses = ["", "stored", "out", "maintenance", "transit"];
  const statusLabels: Record<string, string> = {
    "": t.all, stored: t.stored, out: t.out, maintenance: t.maint, transit: t.transit,
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t.registry}
          backHref="/dashboard"
          action={canCreate ? (
            <button
              onClick={() => router.push("/vehicle/new")}
              className="w-11 h-11 rounded-full border border-gold/40 bg-transparent flex items-center justify-center text-gold text-xl font-light hover:bg-gold hover:text-black transition-all duration-500 active:scale-95"
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
              aria-label="Add vehicle"
            >+</button>
          ) : undefined}
        />

        {/* Search */}
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm font-light tracking-wide transition-all duration-300"
          style={{ transitionTimingFunction: "var(--ease-lux)" }}
        />

        {/* Status filters */}
        <div className="flex flex-wrap gap-2 pb-1">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[11px] tracking-[0.06em] uppercase font-medium transition-all duration-300 border ${
                statusFilter === s
                  ? "bg-gold/15 text-gold border-gold/30"
                  : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/60 hover:border-white/[0.1]"
              }`}
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            >{statusLabels[s]}</button>
          ))}
        </div>

        {/* Vehicle list */}
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3, 4].map((n) => <VehicleCardSkeleton key={n} />)}</div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-danger/80 text-sm font-light">{t.failedLoad}</p>
            <p className="text-white/20 text-xs mt-1">{t.tryAgain}</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-base font-light text-white/30 italic">{t.noVehicles}</p>
            <p className="text-white/15 text-xs mt-2 tracking-wider uppercase">
              {searchInput || statusFilter ? t.adjustFilters : t.addFirst}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop: table view */}
            <div className="hidden lg:block">
              <div className="rounded-2xl overflow-hidden border border-white/[0.06]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {[t.vehicle, t.owner, t.status, t.bay, t.year].map((h) => (
                        <th key={h} className="text-[10px] tracking-[0.15em] uppercase text-gold/40 font-medium text-left px-4 py-3 border-b border-white/[0.06]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr
                        key={v.id}
                        onClick={() => handleVehicleClick(v.id)}
                        className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3.5 border-b border-white/[0.03] text-[13px] font-normal text-white/90">
                          {v.make} {v.model}
                        </td>
                        <td className="px-4 py-3.5 border-b border-white/[0.03] text-[13px] font-light text-white/70">
                          {v.owner_name}
                        </td>
                        <td className="px-4 py-3.5 border-b border-white/[0.03]">
                          <StatusPill status={v.status} />
                        </td>
                        <td className="px-4 py-3.5 border-b border-white/[0.03] text-[13px] font-light text-white/70">
                          —
                        </td>
                        <td className="px-4 py-3.5 border-b border-white/[0.03] text-[13px] font-light text-white/70">
                          {v.year || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile: card view */}
            <div className="lg:hidden space-y-3">
              {vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} onClick={handleVehicleClick} />
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {!isLoading && vehicles.length > 0 && (
          <div className="text-center pt-4 pb-2 space-y-3">
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/50 text-xs disabled:opacity-20 hover:border-gold/30 hover:text-gold transition-all duration-300">{t.previous}</button>
                <span className="text-xs text-white/40 tabular-nums">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/50 text-xs disabled:opacity-20 hover:border-gold/30 hover:text-gold transition-all duration-300">{t.next}</button>
              </div>
            )}
            <p className="text-[10px] tracking-[0.2em] uppercase text-white/20">
              {totalCount} {t.vehicles} {t.inRegistry}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ── Status pill ── */
const statusStyles: Record<string, string> = {
  stored: "bg-success/10 text-success",
  out: "bg-white/10 text-white/50",
  maintenance: "bg-warning/10 text-warning",
  transit: "bg-info/10 text-info",
  sold: "bg-white/[0.06] text-white/40",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-medium tracking-[0.06em] uppercase px-2.5 py-1 rounded-full ${statusStyles[status] || "bg-white/[0.06] text-white/40"}`}>
      {status}
    </span>
  );
}
