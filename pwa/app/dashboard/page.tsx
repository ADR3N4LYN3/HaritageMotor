"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { VehicleCard } from "@/components/ui/VehicleCard";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useAppStore } from "@/store/app.store";
import { useReveal } from "@/hooks/useReveal";
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
   TENANT DASHBOARD — Vehicle Registry
   ══════════════════════════════════════════════════════════════════════ */

function TenantDashboard() {
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

  const vehicles = data?.data || [];
  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  const handleVehicleClick = useCallback(
    (id: string) => router.push(`/vehicle/${id}`),
    [router]
  );

  const statuses = ["", "stored", "out", "maintenance", "transit"];
  const statusLabels: Record<string, string> = {
    "": "All", stored: "Stored", out: "Out", maintenance: "Maint.", transit: "Transit",
  };

  const storedCount = vehicles.filter((v) => v.status === "stored").length;
  const outCount = vehicles.filter((v) => v.status === "out").length;

  return (
    <AppShell>
      <div ref={revealRef} className="space-y-6">
        <div className="reveal-up flex items-center justify-between">
          <div>
            <div className="section-tag mb-3"><span>Vehicle Registry</span></div>
            <h1 className="font-display text-3xl md:text-4xl font-light tracking-wide text-white leading-tight">Your fleet</h1>
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
              { value: totalCount, label: "Total", sub: "vehicles" },
              { value: storedCount, label: "Stored", sub: "in custody" },
              { value: outCount, label: "Out", sub: "with owners" },
            ].map((s) => (
              <div key={s.label} className="bg-dark-2 p-4 md:p-5 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-gold/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <p className="text-2xl md:text-3xl font-sans font-normal text-white/90 tabular-nums">{isLoading ? "-" : s.value}</p>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-gold/70 mt-1 font-medium">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="reveal-up reveal-d2 grid grid-cols-2 gap-3">
          <button onClick={() => router.push("/scan")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift text-left group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></svg>
              </div>
              <div>
                <p className="text-sm font-display font-light text-white/80 group-hover:text-white transition-colors duration-300 tracking-wide">Scan QR</p>
                <p className="text-[10px] text-white/25 mt-0.5">Quick lookup</p>
              </div>
            </div>
          </button>
          <button onClick={() => router.push("/bays")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift text-left group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
              </div>
              <div>
                <p className="text-sm font-display font-light text-white/80 group-hover:text-white transition-colors duration-300 tracking-wide">Bays</p>
                <p className="text-[10px] text-white/25 mt-0.5">Manage facility</p>
              </div>
            </div>
          </button>
          {canCreate && (
            <button onClick={() => router.push("/qr-codes")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift text-left group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" /><rect x="2" y="14" width="8" height="8" rx="1" /><path d="M14 14h4v4h-4zM22 14v4h-4M22 22h-4v-4" /></svg>
                </div>
                <div>
                  <p className="text-sm font-display font-light text-white/80 group-hover:text-white transition-colors duration-300 tracking-wide">QR Codes</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Print labels</p>
                </div>
              </div>
            </button>
          )}
          {user?.role === "admin" && (
            <button onClick={() => router.push("/users")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift text-left group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </div>
                <div>
                  <p className="text-sm font-display font-light text-white/80 group-hover:text-white transition-colors duration-300 tracking-wide">Team</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Manage users</p>
                </div>
              </div>
            </button>
          )}
          {user?.role === "superadmin" && (
            <button onClick={() => router.push("/admin")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift text-left group col-span-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                </div>
                <div>
                  <p className="text-sm font-display font-light text-white/80 group-hover:text-white transition-colors duration-300 tracking-wide">Admin Panel</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Tenants, invitations, platform</p>
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
            placeholder="Search by make, model, owner..."
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm font-light tracking-wide transition-all duration-300"
            style={{ transitionTimingFunction: "var(--ease-lux)" }}
          />
        </div>

        <div className="reveal-up reveal-d4 flex flex-wrap gap-2 pb-1">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] tracking-wide uppercase font-medium transition-all duration-300 border ${
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
            <p className="text-danger/80 text-sm font-light">Failed to load vehicles</p>
            <p className="text-white/20 text-xs mt-1">Please try again later</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-16 reveal-up">
            <p className="font-display text-xl font-light text-white/30 italic">No vehicles found</p>
            <p className="text-white/15 text-xs mt-2 tracking-wider uppercase">
              {searchInput || statusFilter ? "Try adjusting your filters" : "Add your first vehicle to get started"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((vehicle, i) => (
              <div key={vehicle.id} className={`reveal-up reveal-d${Math.min(i + 1, 6)}`}>
                <VehicleCard vehicle={vehicle} onClick={handleVehicleClick} />
              </div>
            ))}
          </div>
        )}

        {!isLoading && vehicles.length > 0 && (
          <div className="reveal-up text-center pt-4 pb-2 space-y-3">
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/50 text-xs disabled:opacity-20 hover:border-gold/30 hover:text-gold transition-all duration-300">Previous</button>
                <span className="text-xs text-white/40 tabular-nums">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/50 text-xs disabled:opacity-20 hover:border-gold/30 hover:text-gold transition-all duration-300">Next</button>
              </div>
            )}
            <p className="text-[10px] tracking-[0.2em] uppercase text-white/20">
              {totalCount} vehicle{totalCount !== 1 ? "s" : ""} in registry
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
