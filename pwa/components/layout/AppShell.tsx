"use client";

import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black relative">
      {/* Noise texture (same as landing) */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.025] z-0" style={{ backgroundImage: noiseBg }} />
      {/* Subtle radial gold glow at top */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-[0.03] z-0"
        style={{ background: "radial-gradient(ellipse at center top, #b8955a 0%, transparent 70%)" }}
      />
      <TopBar />
      <main className="relative z-10 pt-16 pb-20 px-4 max-w-2xl mx-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
