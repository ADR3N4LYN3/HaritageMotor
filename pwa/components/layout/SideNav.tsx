"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app.store";
import { useI18n } from "@/lib/i18n";
import { navI18n } from "@/lib/translations";
import logoCrest from "@/public/logo-crest-v2.png";

type NavItem = { href: string; labelKey: string; icon: React.ComponentType<{ className?: string }> };

const baseNav: NavItem[] = [
  { href: "/dashboard", labelKey: "home", icon: HomeIcon },
  { href: "/vehicles", labelKey: "vehicles", icon: VehicleIcon },
  { href: "/scan", labelKey: "scanQr", icon: ScanIcon },
  { href: "/bays", labelKey: "bays", icon: BayIcon },
  { href: "/tasks", labelKey: "tasks", icon: TaskIcon },
];

const qrNav: NavItem = { href: "/qr-codes", labelKey: "qrCodes", icon: QrIcon };
const teamNav: NavItem = { href: "/users", labelKey: "team", icon: TeamIcon };
const adminNav: NavItem = { href: "/admin", labelKey: "admin", icon: AdminIcon };

export function SideNav() {
  const pathname = usePathname();
  const user = useAppStore((s) => s.user);
  const role = user?.role;
  const { t } = useI18n(navI18n);

  const navItems = [...baseNav];
  if (role === "admin" || role === "operator") navItems.push(qrNav);
  if (role === "admin") navItems.push(teamNav);
  if (role === "superadmin") navItems.push(adminNav);

  return (
    // Width (w-[220px]) synced with lg:left-[220px] in scan/page.tsx
    <aside className="hidden lg:flex w-[220px] shrink-0 flex-col bg-dark-2 border-r border-white/[0.04] h-screen sticky top-0">
      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-2.5 border-b border-white/[0.04]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoCrest.src} alt="HM" className="h-7 w-auto" />
        <span className="font-sans text-[0.65rem] font-semibold tracking-[0.18em] uppercase text-gold">
          Heritage Motor
        </span>
      </div>

      {/* Nav label */}
      <div className="px-4 pt-3 pb-1">
        <span className="text-[11px] tracking-[0.16em] uppercase text-gold/30 font-medium">
          {t.navigation}
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-300 border-l-2 ${
                isActive
                  ? "text-gold bg-gold/[0.05] border-l-gold"
                  : "text-white/35 hover:text-white/55 hover:bg-white/[0.03] border-l-transparent"
              }`}
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            >
              <item.icon className="w-4 h-4" />
              <span>{t[item.labelKey]}</span>
            </Link>
          );
        })}
      </nav>

      {/* Spacer + Profile */}
      <div className="border-t border-white/[0.04] px-2 py-2">
        <Link
          href="/profile"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-300 border-l-2 ${
            pathname === "/profile"
              ? "text-gold bg-gold/[0.05] border-l-gold"
              : "text-white/35 hover:text-white/55 hover:bg-white/[0.03] border-l-transparent"
          }`}
        >
          <ProfileIcon className="w-4 h-4" />
          <span>{t.profile}</span>
        </Link>
      </div>
    </aside>
  );
}

/* ── Icon components ── */

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function VehicleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a1 1 0 0 1 .4-.8l3-2.4A2 2 0 0 1 7.6 5h8.8a2 2 0 0 1 1.2.4l3 2.4a1 1 0 0 1 .4.8v6a2 2 0 0 1-2 2M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M9 17h6" />
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

function TaskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function QrIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="2" width="8" height="8" rx="1" />
      <rect x="14" y="2" width="8" height="8" rx="1" />
      <rect x="2" y="14" width="8" height="8" rx="1" />
      <path d="M14 14h4v4h-4zM22 14v4h-4M22 22h-4v-4" />
    </svg>
  );
}

function TeamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function AdminIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
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
