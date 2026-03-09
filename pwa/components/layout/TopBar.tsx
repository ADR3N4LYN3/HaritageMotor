"use client";

import { useAppStore } from "@/store/app.store";
import { SyncBadge } from "../ui/SyncBadge";

export function TopBar() {
  const user = useAppStore((s) => s.user);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0e0d0b] text-[#faf9f7] px-4 py-3 flex items-center justify-between safe-top">
      <div className="flex items-center gap-2">
        <span className="text-[#b8955a] font-display text-lg font-semibold tracking-wide">
          Heritage Motor
        </span>
      </div>
      <div className="flex items-center gap-3">
        <SyncBadge />
        {user && (
          <div className="text-xs text-[#faf9f7]/60">
            {user.first_name}
          </div>
        )}
      </div>
    </header>
  );
}
