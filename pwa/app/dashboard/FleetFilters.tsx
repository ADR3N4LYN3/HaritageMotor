import { memo } from "react";

interface FleetFiltersProps {
  statusFilter: string;
  onStatusChange: (status: string) => void;
  searchInput: string;
  onSearchChange: (value: string) => void;
  statusLabels: Record<string, string>;
  searchPlaceholder: string;
}

const statuses = ["", "stored", "out", "maintenance", "transit"];

export const FleetFilters = memo(function FleetFilters({
  statusFilter,
  onStatusChange,
  searchInput,
  onSearchChange,
  statusLabels,
  searchPlaceholder,
}: FleetFiltersProps) {
  return (
    <>
      <div className="reveal-up reveal-d3 gold-sep" />

      <div className="reveal-up reveal-d3">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm font-light tracking-wide transition-all duration-300"
          style={{ transitionTimingFunction: "var(--ease-lux)" }}
        />
      </div>

      <div className="reveal-up reveal-d4 flex flex-wrap gap-2 pb-1">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => onStatusChange(s)}
            aria-pressed={statusFilter === s}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[11px] tracking-[0.06em] uppercase font-medium transition-all duration-300 border ${
              statusFilter === s
                ? "bg-gold/15 text-gold border-gold/30"
                : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/60 hover:border-white/[0.1]"
            }`}
            style={{ transitionTimingFunction: "var(--ease-lux)" }}
          >{statusLabels[s]}</button>
        ))}
      </div>
    </>
  );
});
