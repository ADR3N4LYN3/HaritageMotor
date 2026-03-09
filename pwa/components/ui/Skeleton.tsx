export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function VehicleCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#0e0d0b]/5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="skeleton h-5 w-40 mb-2" />
          <div className="skeleton h-4 w-24" />
        </div>
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="flex items-center gap-3 mt-3">
        <div className="skeleton h-4 w-20" />
        <div className="skeleton h-4 w-28" />
      </div>
    </div>
  );
}
