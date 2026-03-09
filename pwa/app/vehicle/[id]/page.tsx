"use client";

import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ActionButton } from "@/components/ui/ActionButton";
import { EventItem } from "@/components/ui/EventItem";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useVehicle, useVehicleTimeline } from "@/hooks/useVehicle";
import { useAppStore } from "@/store/app.store";

export default function VehiclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const user = useAppStore((s) => s.user);
  const role = user?.role || "viewer";

  const { vehicle, isLoading } = useVehicle(id);
  const { events, isLoading: eventsLoading } = useVehicleTimeline(id);

  const canOperate = role === "admin" || role === "operator";
  const canTechnician = canOperate || role === "technician";

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <VehicleCardSkeleton />
          <div className="skeleton h-8 w-32" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!vehicle) {
    return (
      <AppShell>
        <div className="text-center py-12 text-[#0e0d0b]/50">
          Vehicle not found
        </div>
      </AppShell>
    );
  }

  const displayName = `${vehicle.make} ${vehicle.model}`;
  const subtitle = [vehicle.color, vehicle.year].filter(Boolean).join(" · ");

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Vehicle Header */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#0e0d0b]/5">
          <h1 className="font-display text-2xl font-bold text-[#0e0d0b]">
            {displayName}
          </h1>
          {subtitle && (
            <p className="text-[#0e0d0b]/50 mt-1">{subtitle}</p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              vehicle.status === "stored"
                ? "bg-[#22c55e]/10 text-[#22c55e]"
                : vehicle.status === "maintenance"
                ? "bg-[#f59e0b]/10 text-[#f59e0b]"
                : "bg-[#0e0d0b]/10 text-[#0e0d0b]/60"
            }`}>
              {vehicle.status}
            </span>
            <span className="text-sm text-[#0e0d0b]/50">
              {vehicle.owner_name}
            </span>
          </div>
          {vehicle.license_plate && (
            <div className="mt-3 inline-block bg-[#0e0d0b]/5 px-3 py-1 rounded-lg text-sm font-mono text-[#0e0d0b]/70">
              {vehicle.license_plate}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {vehicle.status === "stored" && (
          <div className="space-y-2">
            {canOperate && (
              <ActionButton onClick={() => router.push(`/vehicle/${id}/move`)}>
                Move Vehicle
              </ActionButton>
            )}
            {canTechnician && (
              <ActionButton
                variant="secondary"
                onClick={() => router.push(`/vehicle/${id}/task`)}
              >
                Maintenance Tasks
              </ActionButton>
            )}
            {canTechnician && (
              <ActionButton
                variant="secondary"
                onClick={() => router.push(`/vehicle/${id}/photo`)}
              >
                Add Photo
              </ActionButton>
            )}
            {canOperate && (
              <ActionButton
                variant="danger"
                onClick={() => router.push(`/vehicle/${id}/exit`)}
              >
                Exit Vehicle
              </ActionButton>
            )}
          </div>
        )}

        {/* Timeline */}
        <div>
          <h2 className="text-sm font-semibold text-[#0e0d0b]/40 uppercase tracking-wider mb-3">
            Timeline
          </h2>
          {eventsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="text-center text-sm text-[#0e0d0b]/40 py-4">No events yet</p>
          ) : (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#0e0d0b]/5">
              {events.map((event) => (
                <EventItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
