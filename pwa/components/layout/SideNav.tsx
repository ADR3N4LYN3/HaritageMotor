"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app.store";
import logoCrest from "@/public/logo-crest-v2.png";

const baseNav = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/scan", label: "Scan QR", icon: ScanIcon },
  { href: "/bays", label: "Bays", icon: BayIcon },
  { href: "/tasks", label: "Tasks", icon: TaskIcon },
];

const qrNav = { href: "/qr-codes", label: "QR Codes", icon: QrIcon };
const teamNav = { href: "/users", label: "Team", icon: TeamIcon };
const adminNav = { href: "/admin", label: "Admin", icon: AdminIcon };

export function SideNav() {
  const pathname = usePathname();
  const user = useAppStore((s) => s.user);
  const role = user?.role;

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
        <span className="text-[9px] tracking-[0.16em] uppercase text-gold/30 font-medium">
          Navigation
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
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] transition-all duration-300 border-l-2 ${
                isActive
                  ? "text-gold bg-gold/[0.05] border-l-gold"
                  : "text-white/35 hover:text-white/55 hover:bg-white/[0.03] border-l-transparent"
              }`}
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Spacer + Profile */}
      <div className="border-t border-white/[0.04] px-2 py-2">
        <Link
          href="/profile"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] transition-all duration-300 border-l-2 ${
            pathname === "/profile"
              ? "text-gold bg-gold/[0.05] border-l-gold"
              : "text-white/35 hover:text-white/55 hover:bg-white/[0.03] border-l-transparent"
          }`}
        >
          <ProfileIcon className="w-4 h-4" />
          <span>Profile</span>
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
