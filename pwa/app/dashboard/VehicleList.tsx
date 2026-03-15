import { memo } from "react";
import { VehicleCard } from "@/components/ui/VehicleCard";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import type { Vehicle } from "@/lib/types";

interface VehicleListProps {
  vehicles: Vehicle[];
  isLoading: boolean;
  error: unknown;
  page: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onVehicleClick: (id: string) => void;
  hasFilters: boolean;
  labels: {
    failedLoad: string; tryAgain: string; noVehicles: string;
    adjustFilters: string; addFirst: string;
    vehicle: string; owner: string; status: string; bay: string; year: string;
    previous: string; next: string; vehicles: string; inRegistry: string;
  };
}

/* ── Status pill (desktop table) ── */
const statusStyles: Record<string, string> = {
  stored: "bg-success/10 text-success",
  out: "bg-white/10 text-white/50",
  maintenance: "bg-warning/10 text-warning",
  transit: "bg-info/10 text-info",
  sold: "bg-white/[0.06] text-white/40",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-medium tracking-[0.06em] uppercase px-2.5 py-1 rounded-full ${statusStyles[status] || "bg-white/[0.06] text-white/40"}`}>
      {status}
    </span>
  );
}

export const VehicleList = memo(function VehicleList({
  vehicles, isLoading, error, page, totalCount, totalPages,
  onPageChange, onVehicleClick, hasFilters, labels,
}: VehicleListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">{[1, 2, 3, 4].map((n) => <VehicleCardSkeleton key={n} />)}</div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-danger/80 text-sm font-light">{labels.failedLoad}</p>
        <p className="text-white/20 text-xs mt-1">{labels.tryAgain}</p>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-16 reveal-up">
        <p className="text-base font-light text-white/30 italic">{labels.noVehicles}</p>
        <p className="text-white/15 text-xs mt-2 tracking-wider uppercase">
          {hasFilters ? labels.adjustFilters : labels.addFirst}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop: table view */}
      <div className="hidden lg:block">
        <div className="rounded-2xl overflow-hidden border border-white/[0.06]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {[labels.vehicle, labels.owner, labels.status, labels.bay, labels.year].map((h) => (
                  <th key={h} className="text-[10px] tracking-[0.15em] uppercase text-gold/40 font-medium text-left px-4 py-3 border-b border-white/[0.06]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => onVehicleClick(v.id)}
                  className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3.5 border-b border-white/[0.03] text-[13px] font-normal text-white/90">
                    {v.make} {v.model}
                  </td>
                  <td className="px-4 py-3.5 border-b border-white/[0.03] text-[13px] font-light text-white/70">
                    {v.owner_name}
                  </td>
                  <td className="px-4 py-3.5 border-b border-white/[0.03]">
                    <StatusPill status={v.status} />
                  </td>
                  <td className="px-4 py-3.5 border-b border-white/[0.03] text-[13px] font-light text-white/70">
                    —
                  </td>
                  <td className="px-4 py-3.5 border-b border-white/[0.03] text-[13px] font-light text-white/70">
                    {v.year || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: card view */}
      <div className="lg:hidden space-y-3">
        {vehicles.map((vehicle, i) => (
          <div key={vehicle.id} className={`reveal-up reveal-d${Math.min(i + 1, 6)}`}>
            <VehicleCard vehicle={vehicle} onClick={onVehicleClick} />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="reveal-up text-center pt-4 pb-2 space-y-3">
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/50 text-xs disabled:opacity-20 hover:border-gold/30 hover:text-gold transition-all duration-300">{labels.previous}</button>
            <span className="text-xs text-white/40 tabular-nums">{page} / {totalPages}</span>
            <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/50 text-xs disabled:opacity-20 hover:border-gold/30 hover:text-gold transition-all duration-300">{labels.next}</button>
          </div>
        )}
        <p className="text-[10px] tracking-[0.2em] uppercase text-white/20">
          {totalCount} {labels.vehicles} {labels.inRegistry}
        </p>
      </div>
    </>
  );
});
