"use client";

import { useAppStore } from "@/store/app.store";

export function SyncBadge() {
  const pendingCount = useAppStore((s) => s.pendingCount);

  if (pendingCount === 0) return null;

  return (
    <div className="flex items-center gap-1 bg-warning/20 text-warning px-2 py-0.5 rounded-full text-xs font-medium animate-pulse">
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      {pendingCount}
    </div>
  );
}
