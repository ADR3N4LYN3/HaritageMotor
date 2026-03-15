"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useI18n } from "@/lib/i18n";
import { commonI18n } from "@/lib/translations";
import type { Bay } from "@/lib/types";

const bayStatusColors: Record<string, string> = {
  free: "bg-success/10 text-success",
  occupied: "bg-warning/10 text-warning",
  reserved: "bg-[#3b82f6]/10 text-[#3b82f6]",
  maintenance: "bg-danger/10 text-danger",
};

export function BaysSheet({ search, setSearch, onNavigate }: { search: string; setSearch: (s: string) => void; onNavigate: (id: string) => void }) {
  const { t } = useI18n(commonI18n);
  const { data, isLoading } = useSWR<{ data: Bay[]; total_count: number }>("/bays", { refreshInterval: 30000 });
  const allBays = useMemo(() => data?.data || [], [data]);
  const bays = useMemo(() => {
    if (!search) return allBays;
    const q = search.toLowerCase();
    return allBays.filter((b) => b.code.toLowerCase().includes(q) || b.zone?.toLowerCase().includes(q));
  }, [allBays, search]);

  const stats = useMemo(() => ({
    free: allBays.filter((b) => b.status === "free").length,
    occupied: allBays.filter((b) => b.status === "occupied").length,
    total: allBays.length,
  }), [allBays]);

  return (
    <div className="space-y-4">
      <h2 className="text-[1.3rem] font-light tracking-[0.03em] text-white leading-[1.2]">{t.search === "Search" ? "Bays" : "Emplacements"}</h2>

      {/* Mini stats */}
      {!isLoading && (
        <div className="flex gap-2">
          <div className="bg-white/[0.03] rounded-lg px-3 py-1.5 border border-white/[0.06] text-center flex-1">
            <p className="text-sm font-light text-success">{stats.free}</p>
            <p className="text-[9px] text-white/30">{t.free}</p>
          </div>
          <div className="bg-white/[0.03] rounded-lg px-3 py-1.5 border border-white/[0.06] text-center flex-1">
            <p className="text-sm font-light text-warning">{stats.occupied}</p>
            <p className="text-[9px] text-white/30">{t.occupied}</p>
          </div>
          <div className="bg-white/[0.03] rounded-lg px-3 py-1.5 border border-white/[0.06] text-center flex-1">
            <p className="text-sm font-light text-white">{stats.total}</p>
            <p className="text-[9px] text-white/30">{t.total}</p>
          </div>
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t.searchPlaceholder}
        aria-label={t.search}
        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
      />
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <div key={n} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : bays.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-6">{t.noResults}</p>
      ) : (
        <div className="space-y-2">
          {bays.map((bay) => (
            <button
              key={bay.id}
              onClick={() => onNavigate(bay.id)}
              className="w-full text-left bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{bay.code}</p>
                  {bay.zone && <p className="text-xs text-white/40 mt-0.5">{bay.zone}</p>}
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${bayStatusColors[bay.status] || "bg-white/[0.06] text-white/40"}`}>
                  {bay.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
