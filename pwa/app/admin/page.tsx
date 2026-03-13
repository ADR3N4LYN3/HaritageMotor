"use client";

import { redirect, useRouter } from "next/navigation";
import { useAppStore } from "@/store/app.store";
import { logout } from "@/lib/auth";
import { StatsSection } from "@/components/admin/StatsSection";
import { QuickLinks } from "@/components/admin/QuickLinks";
import { TenantsSection } from "@/components/admin/TenantsSection";
import { InviteSection } from "@/components/admin/InviteSection";

export default function AdminPage() {
  const user = useAppStore((s) => s.user);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (user.role !== "superadmin") {
    redirect("/scan");
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Noise texture (same as landing hero::after) */}
      <div className="fixed inset-0 opacity-[0.025] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      <Header />
      <main className="relative max-w-6xl mx-auto px-6 lg:px-8 py-14 space-y-16">
        <StatsSection />
        <QuickLinks />
        <TenantsSection />
        <InviteSection />
      </main>
    </div>
  );
}

function Header() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-gold/10">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold/60 to-gold-dk/40 flex items-center justify-center border border-gold/20">
            <span className="text-black font-display font-semibold text-sm">H</span>
          </div>
          <div>
            <h1 className="text-sm font-display font-light text-white/90 tracking-[0.2em] uppercase">
              Heritage Motor
            </h1>
            <p className="text-gold/50 text-[10px] tracking-[0.25em] uppercase font-medium">
              Platform Administration
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {user && (
            <span className="text-white/25 text-xs tracking-wider">
              {user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-white/30 text-xs tracking-[0.15em] uppercase hover:text-gold transition-colors duration-500"
            style={{ transitionTimingFunction: "var(--ease-lux)" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
