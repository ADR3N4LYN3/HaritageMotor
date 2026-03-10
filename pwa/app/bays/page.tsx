"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useAppStore } from "@/store/app.store";
import type { Bay } from "@/lib/types";
import useSWR from "swr";

const statusColors: Record<string, string> = {
  free: "bg-success/10 text-success",
  occupied: "bg-warning/10 text-warning",
  reserved: "bg-[#3b82f6]/10 text-[#3b82f6]",
  maintenance: "bg-danger/10 text-danger",
};

const STATUS_OPTIONS = ["", "free", "occupied", "reserved", "maintenance"];

export default function BaysPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const canCreate = user?.role === "admin" || user?.role === "operator";
  const [statusFilter, setStatusFilter] = useState("");

  const queryString = statusFilter ? `?status=${statusFilter}` : "";
  const { data, isLoading, error } = useSWR<{ data: Bay[]; total_count: number }>(
    `/bays${queryString}`,
    { refreshInterval: 30000 }
  );
  const bays = useMemo(() => data?.data || [], [data]);

  const stats = useMemo(() => {
    const free = bays.filter((b) => b.status === "free").length;
    const occupied = bays.filter((b) => b.status === "occupied").length;
    return { free, occupied, total: bays.length };
  }, [bays]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-light tracking-wide text-white">Bays</h1>
          {canCreate && (
            <button
              onClick={() => router.push("/bay/new")}
              className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-white text-xl font-light hover:bg-[#a07d48] transition-colors active:scale-95"
              aria-label="Add bay"
            >
              +
            </button>
          )}
        </div>

        {/* Stats */}
        {!isLoading && !statusFilter && (
          <div className="flex gap-3">
            <div className="bg-white/[0.03] rounded-xl px-3 py-2 border border-white/[0.06] text-center flex-1">
              <p className="text-lg font-light text-success">{stats.free}</p>
              <p className="text-xs text-white/30">Free</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl px-3 py-2 border border-white/[0.06] text-center flex-1">
              <p className="text-lg font-light text-warning">{stats.occupied}</p>
              <p className="text-xs text-white/30">Occupied</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl px-3 py-2 border border-white/[0.06] text-center flex-1">
              <p className="text-lg font-light text-white">{stats.total}</p>
              <p className="text-xs text-white/30">Total</p>
            </div>
          </div>
        )}

        {/* Status filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                statusFilter === s
                  ? "bg-gold/15 text-gold border-gold/30"
                  : "bg-white/[0.04] text-white/50 border-white/[0.06]"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        {/* Bay list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-danger text-sm font-light">
            Failed to load bays
          </div>
        ) : bays.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm font-light">
            No bays found
          </div>
        ) : (
          <div className="space-y-3">
            {bays.map((bay) => (
              <button
                key={bay.id}
                onClick={() => router.push(`/bay/${bay.id}`)}
                className="w-full text-left bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-lg font-light text-white">{bay.code}</h3>
                    {bay.zone && (
                      <p className="text-sm text-white/40 mt-0.5">{bay.zone}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      statusColors[bay.status] || statusColors.free
                    }`}
                  >
                    {bay.status}
                  </span>
                </div>
                {bay.features && bay.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {bay.features.map((feature) => (
                      <span
                        key={feature}
                        className="text-xs bg-white/[0.06] text-white/40 px-2 py-0.5 rounded"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
