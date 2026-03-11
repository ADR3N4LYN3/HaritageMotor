"use client";

import Image from "next/image";
import { useAppStore } from "@/store/app.store";
import { SyncBadge } from "../ui/SyncBadge";
const logoCrest = "/logo-crest-v2.png";

export function TopBar() {
  const user = useAppStore((s) => s.user);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black text-white px-4 py-3 flex items-center justify-between safe-top border-b border-gold/10">
      <div className="flex items-center gap-3">
        {/* Mini crest */}
        <Image src={logoCrest} alt="HM" width={30} height={30} className="h-[30px] w-auto flex-shrink-0" />
        <span className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-[#b8955a]">
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
