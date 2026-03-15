import { memo } from "react";

interface StatsGridProps {
  total: number;
  stored: number;
  out: number;
  isLoading: boolean;
  labels: { total: string; stored: string; out: string; vehicles: string; inCustody: string; withOwners: string };
}

export const StatsGrid = memo(function StatsGrid({ total, stored, out, isLoading, labels }: StatsGridProps) {
  const stats = [
    { value: total, label: labels.total, sub: labels.vehicles },
    { value: stored, label: labels.stored, sub: labels.inCustody },
    { value: out, label: labels.out, sub: labels.withOwners },
  ];

  return (
    <div className="grid grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
      {stats.map((s) => (
        <div key={s.label} className="bg-dark-2 p-4 md:p-5 text-center group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-gold/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative">
            <p className="text-[1.75rem] md:text-[2rem] font-sans font-normal text-white/90 tabular-nums">{isLoading ? "-" : s.value}</p>
            <p className="text-[10px] tracking-[0.15em] uppercase text-gold/70 mt-1 font-medium">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
});
