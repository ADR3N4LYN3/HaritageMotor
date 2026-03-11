"use client";

import { useAppStore } from "@/store/app.store";
import { SyncBadge } from "../ui/SyncBadge";

export function TopBar() {
  const user = useAppStore((s) => s.user);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl text-white px-4 py-3 flex items-center justify-between safe-top border-b border-gold/10">
      <div className="flex items-center gap-3">
        {/* Mini crest */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-crest-v2.png" alt="HM" className="h-[30px] w-auto flex-shrink-0" />
        <span className="font-display text-[13px] font-light tracking-[0.2em] uppercase text-gold">
          Heritage Motor
        </span>
      </div>
      <div className="flex items-center gap-3">
        <SyncBadge />
        {user && (
          <div className="text-[11px] text-white/35 tracking-wider font-light">
            {user.first_name}
          </div>
        )}
      </div>
    </header>
  );
}
