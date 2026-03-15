"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { navI18n } from "@/lib/translations";

type NavItem = { href: string; labelKey: string; icon: React.ComponentType<{ className?: string }> };

const navItems: NavItem[] = [
  { href: "/dashboard", labelKey: "home", icon: HomeIcon },
  { href: "/scan", labelKey: "scanQr", icon: ScanIcon },
  { href: "/bays", labelKey: "bays", icon: BayIcon },
  { href: "/profile", labelKey: "profile", icon: ProfileIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n(navI18n);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-gold/10 safe-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full touch-target transition-colors ${
                isActive ? "text-gold" : "text-white/30 hover:text-white/50"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] tracking-[0.06em] font-medium">{t[item.labelKey]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function BayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
