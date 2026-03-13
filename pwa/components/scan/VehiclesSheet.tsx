"use client";

import useSWR from "swr";
import type { Vehicle } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

export function VehiclesSheet({ search, setSearch, onNavigate }: { search: string; setSearch: (s: string) => void; onNavigate: (id: string) => void }) {
  const query = search ? `?search=${encodeURIComponent(search)}&per_page=20` : "?per_page=20";
  const { data, isLoading } = useSWR<{ data: Vehicle[]; total_count: number }>(`/vehicles${query}`, { refreshInterval: 30000 });
  const vehicles = data?.data || [];

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-light tracking-wide text-white">Vehicles</h2>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search make, model, owner..."
        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
      />
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <div key={n} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : vehicles.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-6">No vehicles found</p>
      ) : (
        <div className="space-y-2">
          {vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => onNavigate(v.id)}
              className="w-full text-left bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{v.make} {v.model}</p>
                  <p className="text-xs text-white/40 mt-0.5">{v.owner_name}{v.year ? ` · ${v.year}` : ""}</p>
                </div>
                <StatusBadge status={v.status} />
              </div>
            </button>
          ))}
          {data && data.total_count > 20 && (
            <p className="text-center text-[10px] text-white/20 uppercase tracking-widest pt-2">
              {data.total_count} total — showing first 20
            </p>
          )}
        </div>
      )}
    </div>
  );
}
