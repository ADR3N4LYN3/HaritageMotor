"use client";

import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBay } from "@/hooks/useBay";
import { useAppStore } from "@/store/app.store";
import type { Vehicle } from "@/lib/types";
import useSWR from "swr";

export default function BayPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const user = useAppStore((s) => s.user);
  const canEdit = user?.role === "admin" || user?.role === "operator";

  const { bay, isLoading } = useBay(id);

  // Fetch vehicles in this bay
  const { data: vehiclesData, error: vehiclesError } = useSWR<{ data: Vehicle[] }>(
    id ? `/vehicles?bay_id=${id}` : null
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
        <div className="text-center py-12 text-white/50">Bay not found</div>
      </AppShell>
    );
  }

  const statusColors: Record<string, string> = {
    free: "bg-success/10 text-success",
    occupied: "bg-warning/10 text-warning",
    reserved: "bg-[#3b82f6]/10 text-[#3b82f6]",
    maintenance: "bg-danger/10 text-danger",
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Bay Header */}
        <PageHeader
          title={bay.code}
          subtitle={bay.zone ? `Zone: ${bay.zone}` : undefined}
          backHref="/bays"
          action={canEdit ? (
            <button
              onClick={() => router.push(`/bay/${id}/edit`)}
              className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 text-xs hover:text-gold hover:border-gold/30 transition-all duration-300"
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            >
              Edit
            </button>
          ) : undefined}
        />
        <div className="bg-white/[0.025] rounded-xl p-5 border border-white/[0.05] gold-border-top">
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
                  className="text-xs bg-white/[0.06] text-white/50 px-2 py-0.5 rounded"
                >
                  {feature.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Vehicle in this bay */}
        {vehiclesError && (
          <div className="text-center py-8 text-danger text-sm">
            Failed to load vehicles
          </div>
        )}
        {!vehiclesError && vehicles.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
              Vehicle in Bay
            </h2>
            {vehicles.map((v) => (
              <button
                key={v.id}
                onClick={() => router.push(`/vehicle/${v.id}`)}
                className="w-full text-left bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] active:scale-[0.99] transition-transform"
              >
                <h3 className="text-[1rem] font-normal text-white">
                  {v.make} {v.model}
                </h3>
                <p className="text-sm text-white/50 mt-0.5">
                  {v.color} · {v.owner_name}
                </p>
              </button>
            ))}
          </div>
        )}

        {bay.status === "free" && (
          <div className="text-center py-8 text-white/30 text-sm">
            This bay is available
          </div>
        )}
      </div>
    </AppShell>
  );
}
