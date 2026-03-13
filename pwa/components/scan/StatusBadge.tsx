"use client";

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    stored: "bg-success/10 text-success",
    out: "bg-white/[0.06] text-white/40",
    transit: "bg-warning/10 text-warning",
    maintenance: "bg-danger/10 text-danger",
    sold: "bg-white/[0.04] text-white/25",
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colors[status] || colors.stored}`}>
      {status}
    </span>
  );
}
