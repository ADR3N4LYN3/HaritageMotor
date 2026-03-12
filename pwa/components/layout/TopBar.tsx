"use client";

import Link from "next/link";
import { useAppStore } from "@/store/app.store";
import { SyncBadge } from "../ui/SyncBadge";
import logoCrest from "@/public/logo-crest-v2.png";

export function TopBar() {
  const user = useAppStore((s) => s.user);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl text-white px-4 py-3 flex items-center justify-between safe-top border-b border-gold/10">
      <div className="flex items-center gap-3">
        {/* Mini crest */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoCrest.src} alt="HM" className="h-[30px] w-auto flex-shrink-0" />
        <span className="font-display text-[13px] font-light tracking-[0.2em] uppercase text-gold">
          Heritage Motor
        </span>
      </div>
      <div className="flex items-center gap-3">
        <SyncBadge />
        {user && (
          <Link
            href="/profile"
            className="w-8 h-8 rounded-full border border-white/[0.12] bg-white/[0.06] flex items-center justify-center text-[11px] font-medium text-gold/80 hover:border-gold/30 hover:text-gold transition-all duration-300"
            aria-label="Profile"
          >
            {user.first_name[0]}{user.last_name[0]}
          </Link>
        )}
      </div>
    </header>
  );
}
