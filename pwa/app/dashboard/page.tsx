"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { useAppStore } from "@/store/app.store";
import { useReveal } from "@/hooks/useReveal";
import { useI18n } from "@/lib/i18n";
import { dashboardI18n } from "@/lib/translations";
import useSWR from "swr";
import type { Vehicle } from "@/lib/types";
import { StatsGrid } from "./StatsGrid";
import { FleetFilters } from "./FleetFilters";
import { ActionGrid } from "./ActionGrid";
import { VehicleList } from "./VehicleList";

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
  const revealRef = useReveal();
  const { t } = useI18n(dashboardI18n);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [page, setPage] = useState(1);
  const PER_PAGE = 20;
  const [statusFilter, setStatusFilter] = useState("");

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
    { refreshInterval: 30000, dedupingInterval: 60000 }
  );

  const vehicles = data?.data || [];
  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  const handleVehicleClick = useCallback(
    (id: string) => router.push(`/vehicle/${id}`),
    [router]
  );

  const statusLabels: Record<string, string> = useMemo(() => ({
    "": t.all, stored: t.stored, out: t.out, maintenance: t.maint, transit: t.transit,
  }), [t.all, t.stored, t.out, t.maint, t.transit]);

  const fleetTotal = statsAll?.total_count ?? 0;
  const { storedCount, outCount } = useMemo(() => {
    const allVehicles = statsAll?.data || [];
    let stored = 0, out = 0;
    for (const v of allVehicles) {
      if (v.status === "stored") stored++;
      else if (v.status === "out") out++;
    }
    return { storedCount: stored, outCount: out };
  }, [statsAll?.data]);

  const statsLabels = useMemo(() => ({
    total: t.total, stored: t.stored, out: t.out,
    vehicles: t.vehicles, inCustody: t.inCustody, withOwners: t.withOwners,
  }), [t.total, t.stored, t.out, t.vehicles, t.inCustody, t.withOwners]);

  const actionLabels = useMemo(() => ({
    scanQr: t.scanQr, quickLookup: t.quickLookup,
    bays: t.bays, manageFacility: t.manageFacility,
    qrCodes: t.qrCodes, printLabels: t.printLabels,
    team: t.team, manageUsers: t.manageUsers,
    auditLog: t.auditLog, auditSub: t.auditSub,
    adminPanel: t.adminPanel, adminSub: t.adminSub,
  }), [t.scanQr, t.quickLookup, t.bays, t.manageFacility, t.qrCodes, t.printLabels, t.team, t.manageUsers, t.auditLog, t.auditSub, t.adminPanel, t.adminSub]);

  const vehicleListLabels = useMemo(() => ({
    failedLoad: t.failedLoad, tryAgain: t.tryAgain, noVehicles: t.noVehicles,
    adjustFilters: t.adjustFilters, addFirst: t.addFirst,
    vehicle: t.vehicle, owner: t.owner, status: t.status, bay: t.bay, year: t.year,
    previous: t.previous, next: t.next, vehicles: t.vehicles, inRegistry: t.inRegistry,
  }), [t.failedLoad, t.tryAgain, t.noVehicles, t.adjustFilters, t.addFirst, t.vehicle, t.owner, t.status, t.bay, t.year, t.previous, t.next, t.vehicles, t.inRegistry]);

  return (
    <AppShell wide>
      <div ref={revealRef}>
        {/* Header + Stats — full width */}
        <div className="space-y-6 mb-6">
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
            <StatsGrid total={fleetTotal} stored={storedCount} out={outCount} isLoading={isLoading} labels={statsLabels} />
          </div>
        </div>

        {/* Mobile: tabs (Fleet / Activity) */}
        <div className="lg:hidden">
          <div className="reveal-up reveal-d1 flex gap-0 border-b border-white/[0.06] mb-6">
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
        </div>

        {/* Desktop: 2-column layout (2/3 fleet + 1/3 activity) — Mobile: tabbed */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-8 lg:items-start">
          {/* Left column — Fleet (2/3) */}
          <div className={`lg:col-span-2 ${activeTab !== "fleet" ? "hidden lg:block" : ""}`}>
            <div className="space-y-6">
              <ActionGrid canCreate={!!canCreate} isAdmin={user?.role === "admin"} isSuperAdmin={user?.role === "superadmin"} labels={actionLabels} />

              <FleetFilters
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                searchInput={searchInput}
                onSearchChange={setSearchInput}
                statusLabels={statusLabels}
                searchPlaceholder={t.searchPlaceholder}
              />

              <VehicleList
                vehicles={vehicles}
                isLoading={isLoading}
                error={error}
                page={page}
                totalCount={totalCount}
                totalPages={totalPages}
                onPageChange={setPage}
                onVehicleClick={handleVehicleClick}
                hasFilters={!!(searchInput || statusFilter)}
                labels={vehicleListLabels}
              />
            </div>
          </div>

          {/* Right column — Activity feed (1/3) — desktop always visible, mobile tab */}
          <div className={`lg:col-span-1 lg:self-start lg:pl-6 lg:border-l lg:border-white/[0.06] ${activeTab !== "activity" ? "hidden lg:block" : ""}`}>
            <div className="lg:sticky lg:top-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1.5 h-1.5 rounded-full bg-gold/60 shadow-[0_0_10px_rgba(184,149,90,0.4)]" />
                <p className="text-[11px] tracking-[0.18em] uppercase text-gold/60 font-semibold">
                  {t.recentActivity}
                </p>
              </div>
              <ActivityFeed active />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
