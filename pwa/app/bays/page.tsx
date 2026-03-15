"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app.store";
import { useI18n } from "@/lib/i18n";
import { baysI18n } from "@/lib/translations";
import type { Bay } from "@/lib/types";
import useSWR from "swr";

const statusColors: Record<string, string> = {
  free: "bg-success/10 text-success",
  occupied: "bg-warning/10 text-warning",
  reserved: "bg-[#3b82f6]/10 text-[#3b82f6]",
  maintenance: "bg-danger/10 text-danger",
};

export default function BaysPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const canCreate = user?.role === "admin" || user?.role === "operator";
  const [statusFilter, setStatusFilter] = useState("");
  const { t } = useI18n(baysI18n);

  const STATUS_OPTIONS = ["", "free", "occupied", "reserved", "maintenance"];
  const statusLabels: Record<string, string> = {
    "": t.all, free: t.free, occupied: t.occupied, reserved: t.reserved, maintenance: t.maintenance,
  };

  const queryString = statusFilter ? `?status=${statusFilter}` : "";
  const { data, isLoading, error } = useSWR<{ data: Bay[]; total_count: number }>(
    `/bays${queryString}`,
    { refreshInterval: 30000 }
  );
  const bays = useMemo(() => data?.data || [], [data]);

  // Unfiltered stats — always fetch all bays for counters
  const { data: statsAll } = useSWR<{ data: Bay[]; total_count: number }>(
    "/bays",
    { refreshInterval: 30000 }
  );
  const stats = useMemo(() => {
    const all = statsAll?.data || [];
    const free = all.filter((b) => b.status === "free").length;
    const occupied = all.filter((b) => b.status === "occupied").length;
    return { free, occupied, total: all.length };
  }, [statsAll]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t.title}
          backHref="/dashboard"
          action={canCreate ? (
            <button
              onClick={() => router.push("/bay/new")}
              className="w-11 h-11 rounded-full border border-gold/40 bg-transparent flex items-center justify-center text-gold text-xl font-light hover:bg-gold hover:text-black transition-all duration-500 active:scale-95"
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
              aria-label={t.addBay}
            >
              +
            </button>
          ) : undefined}
        />

        {/* Stats */}
        {!isLoading && (
          <div className="flex gap-3">
            <div className="bg-white/[0.03] rounded-2xl px-3 py-2 border border-white/[0.06] text-center flex-1">
              <p className="text-lg font-light text-success">{stats.free}</p>
              <p className="text-xs text-white/30">{t.free}</p>
            </div>
            <div className="bg-white/[0.03] rounded-2xl px-3 py-2 border border-white/[0.06] text-center flex-1">
              <p className="text-lg font-light text-warning">{stats.occupied}</p>
              <p className="text-xs text-white/30">{t.occupied}</p>
            </div>
            <div className="bg-white/[0.03] rounded-2xl px-3 py-2 border border-white/[0.06] text-center flex-1">
              <p className="text-lg font-light text-white">{stats.total}</p>
              <p className="text-xs text-white/30">{t.total}</p>
            </div>
          </div>
        )}

        {/* Status filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                statusFilter === s
                  ? "bg-gold/15 text-gold border-gold/30"
                  : "bg-white/[0.03] text-white/50 border-white/[0.06]"
              }`}
            >
              {statusLabels[s] || s}
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
            {t.failedLoad}
          </div>
        ) : bays.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm font-light">
            {t.noBays}
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
                    <h3 className="text-[1rem] font-normal text-white">{bay.code}</h3>
                    {bay.zone && (
                      <p className="text-sm text-white/40 mt-0.5">{bay.zone}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      statusColors[bay.status] || statusColors.free
                    }`}
                  >
                    {statusLabels[bay.status] || bay.status}
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
