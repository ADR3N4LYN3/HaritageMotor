"use client";

import { useAppStore } from "@/store/app.store";
import { SyncBadge } from "../ui/SyncBadge";

export function TopBar() {
  const user = useAppStore((s) => s.user);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black text-white px-4 py-3 flex items-center justify-between safe-top border-b border-gold/10">
      <div className="flex items-center gap-3">
        {/* Mini crest */}
        <svg className="w-[26px] h-auto flex-shrink-0" viewBox="0 0 280 336" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="tGH" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#96783f"/><stop offset="50%" stopColor="#dcc28a"/><stop offset="100%" stopColor="#96783f"/>
            </linearGradient>
            <linearGradient id="tDk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#191816"/><stop offset="100%" stopColor="#0e0d0b"/>
            </linearGradient>
            <linearGradient id="tGV" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dcc28a"/><stop offset="45%" stopColor="#b8955a"/><stop offset="100%" stopColor="#96783f"/>
            </linearGradient>
          </defs>
          <path d="M140,4 L264,4 Q276,4 276,16 L276,186 Q276,230 248,260 Q218,292 140,332 Q62,292 32,260 Q4,230 4,186 L4,16 Q4,4 16,4 Z" fill="url(#tGH)"/>
          <path d="M140,12 L260,12 Q268,12 268,20 L268,184 Q268,226 242,254 Q214,284 140,322 Q66,284 38,254 Q12,226 12,184 L12,20 Q12,12 20,12 Z" fill="url(#tDk)"/>
          <path d="M140,22 L254,22 Q260,22 260,28 L260,180 Q260,220 236,246 Q210,274 140,310 Q70,274 44,246 Q20,220 20,180 L20,28 Q20,22 26,22 Z" fill="none" stroke="#b8955a" strokeWidth="1.2"/>
          <text x="140" y="185" textAnchor="middle" fontFamily="'Cormorant Garamond','Georgia',serif" fontSize="118" fontWeight="700" letterSpacing="5" fill="url(#tGV)">HM</text>
        </svg>
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
