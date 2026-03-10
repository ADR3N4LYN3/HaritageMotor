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
        <div className="text-center py-12 text-white/50">
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
        <div className="bg-white/[0.03] rounded-2xl p-5 border border-white/[0.06]">
          <h1 className="font-display text-2xl font-light tracking-wide text-white">
            {displayName}
          </h1>
          {subtitle && (
            <p className="text-white/50 mt-1">{subtitle}</p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              vehicle.status === "stored"
                ? "bg-success/10 text-success"
                : vehicle.status === "maintenance"
                ? "bg-warning/10 text-warning"
                : "bg-white/10 text-white/50"
            }`}>
              {vehicle.status}
            </span>
            <span className="text-sm text-white/50">
              {vehicle.owner_name}
            </span>
          </div>
          {vehicle.license_plate && (
            <div className="mt-3 inline-block bg-white/[0.06] px-3 py-1 rounded-lg text-sm font-mono text-white/70">
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
          <h2 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            Timeline
          </h2>
          {eventsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="text-center text-sm text-white/30 py-4">No events yet</p>
          ) : (
            <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
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
