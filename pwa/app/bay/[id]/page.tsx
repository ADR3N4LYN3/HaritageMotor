"use client";

import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useBay } from "@/hooks/useBay";
import { api } from "@/lib/api";
import type { Vehicle } from "@/lib/types";
import useSWR from "swr";

export default function BayPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { bay, isLoading } = useBay(id);

  // Fetch vehicles in this bay
  const { data: vehiclesData } = useSWR(
    id ? `/vehicles?bay_id=${id}` : null,
    (url: string) => api.get<{ data: Vehicle[] }>(url)
  );
  const vehicles = vehiclesData?.data || [];

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (!bay) {
    return (
      <AppShell>
        <div className="text-center py-12 text-[#0e0d0b]/50">Bay not found</div>
      </AppShell>
    );
  }

  const statusColors: Record<string, string> = {
    free: "bg-[#22c55e]/10 text-[#22c55e]",
    occupied: "bg-[#f59e0b]/10 text-[#f59e0b]",
    reserved: "bg-[#3b82f6]/10 text-[#3b82f6]",
    maintenance: "bg-[#ef4444]/10 text-[#ef4444]",
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Bay Header */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#0e0d0b]/5">
          <h1 className="font-display text-2xl font-bold text-[#0e0d0b]">
            {bay.code}
          </h1>
          {bay.zone && (
            <p className="text-[#0e0d0b]/50 mt-1">Zone: {bay.zone}</p>
          )}
          <div className="mt-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[bay.status] || statusColors.free}`}>
              {bay.status}
            </span>
          </div>
          {bay.features && bay.features.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {bay.features.map((feature) => (
                <span
                  key={feature}
                  className="text-xs bg-[#0e0d0b]/5 text-[#0e0d0b]/60 px-2 py-0.5 rounded"
                >
                  {feature}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Vehicle in this bay */}
        {vehicles.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-[#0e0d0b]/40 uppercase tracking-wider mb-3">
              Vehicle in Bay
            </h2>
            {vehicles.map((v) => (
              <button
                key={v.id}
                onClick={() => router.push(`/vehicle/${v.id}`)}
                className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-[#0e0d0b]/5 active:scale-[0.99] transition-transform"
              >
                <h3 className="font-display text-lg font-semibold">
                  {v.make} {v.model}
                </h3>
                <p className="text-sm text-[#0e0d0b]/50 mt-0.5">
                  {v.color} · {v.owner_name}
                </p>
              </button>
            ))}
          </div>
        )}

        {bay.status === "free" && (
          <div className="text-center py-8 text-[#0e0d0b]/30 text-sm">
            This bay is available
          </div>
        )}
      </div>
    </AppShell>
  );
}
