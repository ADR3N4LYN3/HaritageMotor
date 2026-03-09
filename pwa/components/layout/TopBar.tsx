"use client";

import { useAppStore } from "@/store/app.store";
import { SyncBadge } from "../ui/SyncBadge";

export function TopBar() {
  const user = useAppStore((s) => s.user);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black text-white px-4 py-3 flex items-center justify-between safe-top">
      <div className="flex items-center gap-2">
        <span className="text-gold font-display text-lg font-semibold tracking-wide">
          Heritage Motor
        </span>
      </div>
      <div className="flex items-center gap-3">
        <SyncBadge />
        {user && (
          <div className="text-xs text-white/60">
            {user.first_name}
          </div>
        )}
      </div>
    </header>
  );
}
