"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { VehicleCard } from "@/components/ui/VehicleCard";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { useAppStore } from "@/store/app.store";
import { useReveal } from "@/hooks/useReveal";
import { useI18n } from "@/lib/i18n";
import { dashboardI18n } from "@/lib/translations";
import useSWR from "swr";
import type { Vehicle } from "@/lib/types";

/* ══════════════════════════════════════════════════════════════════════
   ROUTE: /dashboard — Vehicle registry for all roles
   ══════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const user = useAppStore((s) => s.user);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  return <TenantDashboard />;
}

/* ══════════════════════════════════════════════════════════════════════
   TENANT DASHBOARD — Vehicle Registry + Activity Feed
   ══════════════════════════════════════════════════════════════════════ */

type DashboardTab = "fleet" | "activity";

function TenantDashboard() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const canCreate = user?.role === "admin" || user?.role === "operator";
  const [activeTab, setActiveTab] = useState<DashboardTab>("fleet");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const revealRef = useReveal();
  const { t } = useI18n(dashboardI18n);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const queryString = useMemo(() => {
    const queryParams = new URLSearchParams();
    if (debouncedSearch) queryParams.set("search", debouncedSearch);
    if (statusFilter) queryParams.set("status", statusFilter);
    queryParams.set("page", String(page));
    queryParams.set("per_page", String(PER_PAGE));
    return queryParams.toString();
  }, [debouncedSearch, statusFilter, page]);

  const { data, isLoading, error } = useSWR<{ data: Vehicle[]; total_count: number }>(
    `/vehicles?${queryString}`,
    { refreshInterval: 30000 }
  );

  // Unfiltered stats — always fetch totals regardless of active filter
  const { data: statsAll } = useSWR<{ data: Vehicle[]; total_count: number }>(
    "/vehicles?page=1&per_page=200",
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

  const statsVehicles = statsAll?.data || [];
  const fleetTotal = statsAll?.total_count ?? 0;
  const storedCount = statsVehicles.filter((v) => v.status === "stored").length;
  const outCount = statsVehicles.filter((v) => v.status === "out").length;

  return (
    <AppShell>
      <div ref={revealRef} className="space-y-6">
        <div className="reveal-up flex items-center justify-between">
          <div>
            <div className="section-tag mb-3"><span>{t.registry}</span></div>
            <h1 className="text-[1.6rem] md:text-[2rem] font-light tracking-[0.03em] text-white leading-[1.2]">{t.fleet}</h1>
          </div>
          {canCreate && (
            <button
              onClick={() => router.push("/vehicle/new")}
              className="w-11 h-11 rounded-full border border-gold/40 bg-transparent flex items-center justify-center text-gold text-xl font-light hover:bg-gold hover:text-black transition-all duration-500 active:scale-95"
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
              aria-label="Add vehicle"
            >+</button>
          )}
        </div>

        <div className="reveal-up reveal-d1">
          <div className="grid grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
            {[
              { value: fleetTotal, label: t.total, sub: t.vehicles },
              { value: storedCount, label: t.stored, sub: t.inCustody },
              { value: outCount, label: t.out, sub: t.withOwners },
            ].map((s) => (
              <div key={s.label} className="bg-dark-2 p-4 md:p-5 text-center group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-gold/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <p className="text-[1.75rem] md:text-[2rem] font-sans font-normal text-white/90 tabular-nums">{isLoading ? "-" : s.value}</p>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-gold/70 mt-1 font-medium">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs: Fleet / Activity */}
        <div className="reveal-up reveal-d1 flex gap-0 border-b border-white/[0.06]">
          {(["fleet", "activity"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={`px-5 py-3 text-[11px] tracking-[0.12em] uppercase font-medium border-b-2 transition-all duration-300 ${
                activeTab === tab
                  ? "text-gold border-b-gold"
                  : "text-white/30 border-b-transparent hover:text-white/50"
              }`}
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            >
              {tab === "fleet" ? t.tabFleet : t.tabActivity}
            </button>
          ))}
        </div>

        {/* Fleet Tab — always mounted, hidden when inactive to preserve reveal state */}
        <div className={activeTab !== "fleet" ? "hidden" : "space-y-6"}>
          <div className="reveal-up reveal-d2 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button onClick={() => router.push("/scan")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift group">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></svg>
                </div>
                <div>
                  <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300">{t.scanQr}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{t.quickLookup}</p>
                </div>
              </div>
            </button>
            <button onClick={() => router.push("/bays")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift group">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                </div>
                <div>
                  <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300">{t.bays}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{t.manageFacility}</p>
                </div>
              </div>
            </button>
            {canCreate && (
              <button onClick={() => router.push("/qr-codes")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift group">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" /><rect x="2" y="14" width="8" height="8" rx="1" /><path d="M14 14h4v4h-4zM22 14v4h-4M22 22h-4v-4" /></svg>
                  </div>
                  <div>
                    <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300">{t.qrCodes}</p>
                    <p className="text-[10px] text-white/25 mt-0.5">{t.printLabels}</p>
                  </div>
                </div>
              </button>
            )}
            {user?.role === "admin" && (
              <button onClick={() => router.push("/users")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift group">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  </div>
                  <div>
                    <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300">{t.team}</p>
                    <p className="text-[10px] text-white/25 mt-0.5">{t.manageUsers}</p>
                  </div>
                </div>
              </button>
            )}
            {user?.role === "admin" && (
              <button onClick={() => router.push("/audit")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift group">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                  </div>
                  <div>
                    <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300">{t.auditLog}</p>
                    <p className="text-[10px] text-white/25 mt-0.5">{t.auditSub}</p>
                  </div>
                </div>
              </button>
            )}
            {user?.role === "superadmin" && (
              <button onClick={() => router.push("/admin")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift group col-span-2 lg:col-span-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                  </div>
                  <div>
                    <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300">{t.adminPanel}</p>
                    <p className="text-[10px] text-white/25 mt-0.5">{t.adminSub}</p>
                  </div>
                </div>
              </button>
            )}
          </div>

          <div className="reveal-up reveal-d3 gold-sep" />

          <div className="reveal-up reveal-d3">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm font-light tracking-wide transition-all duration-300"
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            />
          </div>

          <div className="reveal-up reveal-d4 flex flex-wrap gap-2 pb-1">
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

          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3, 4].map((n) => <VehicleCardSkeleton key={n} />)}</div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-danger/80 text-sm font-light">{t.failedLoad}</p>
              <p className="text-white/20 text-xs mt-1">{t.tryAgain}</p>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-16 reveal-up">
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
                {vehicles.map((vehicle, i) => (
                  <div key={vehicle.id} className={`reveal-up reveal-d${Math.min(i + 1, 6)}`}>
                    <VehicleCard vehicle={vehicle} onClick={handleVehicleClick} />
                  </div>
                ))}
              </div>
            </>
          )}

          {!isLoading && vehicles.length > 0 && (
            <div className="reveal-up text-center pt-4 pb-2 space-y-3">
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

        {/* Activity Tab — always mounted, hidden when inactive */}
        <div className={activeTab !== "activity" ? "hidden" : undefined}>
          <div className="reveal-up">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-1.5 h-1.5 rounded-full bg-gold/60 shadow-[0_0_10px_rgba(184,149,90,0.4)]" />
              <p className="text-[11px] tracking-[0.18em] uppercase text-gold/60 font-semibold">
                {t.recentActivity}
              </p>
            </div>
            <ActivityFeed active={activeTab === "activity"} />
          </div>
        </div>
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
