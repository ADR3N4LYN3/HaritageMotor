import type { Vehicle } from "@/lib/types";

interface VehicleCardProps {
  vehicle: Vehicle;
  bayName?: string;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  stored: "bg-[#22c55e]/10 text-[#22c55e]",
  out: "bg-[#0e0d0b]/10 text-[#0e0d0b]/60",
  maintenance: "bg-[#f59e0b]/10 text-[#f59e0b]",
  transit: "bg-[#3b82f6]/10 text-[#3b82f6]",
  sold: "bg-[#0e0d0b]/10 text-[#0e0d0b]/40",
};

export function VehicleCard({ vehicle, bayName, onClick }: VehicleCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-[#0e0d0b]/5 active:scale-[0.99] transition-transform touch-target"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-semibold text-[#0e0d0b] truncate">
            {vehicle.make} {vehicle.model}
          </h3>
          {vehicle.color && (
            <p className="text-sm text-[#0e0d0b]/50 mt-0.5">
              {vehicle.color}
              {vehicle.year ? ` · ${vehicle.year}` : ""}
            </p>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${statusColors[vehicle.status] || statusColors.stored}`}>
          {vehicle.status}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-3 text-sm text-[#0e0d0b]/60">
        {bayName && (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
            {bayName}
          </span>
        )}
        <span>{vehicle.owner_name}</span>
      </div>
    </button>
  );
}
