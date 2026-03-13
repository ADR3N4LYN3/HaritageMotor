"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app.store";
import { SyncBadge } from "../ui/SyncBadge";
import { LangSwitcher } from "../ui/LangSwitcher";
import useSWR from "swr";

const pageLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/scan": "Scan QR",
  "/bays": "Bays",
  "/tasks": "Tasks",
  "/qr-codes": "QR Codes",
  "/users": "Team",
  "/profile": "Profile",
  "/admin": "Admin",
};

export function DesktopTopBar() {
  const user = useAppStore((s) => s.user);
  const pathname = usePathname();
  const { data: taskData } = useSWR<{ data: unknown[]; total_count: number }>(
    user ? "/tasks?status=pending&per_page=1" : null,
    { refreshInterval: 60000 }
  );
  const pendingTasks = taskData?.total_count ?? 0;

  const pageLabel = Object.entries(pageLabels).find(
    ([path]) => pathname === path || (path !== "/dashboard" && pathname.startsWith(path))
  )?.[1] || "";

  return (
    <header className="h-[52px] shrink-0 flex items-center justify-between px-7 border-b border-white/[0.04] bg-black">
      <p className="text-[13px] text-white/50">{pageLabel}</p>
      <div className="flex items-center gap-3.5">
        <SyncBadge />
        <LangSwitcher />
        {user && (
          <Link href="/tasks" className="relative" aria-label="Pending tasks">
            <svg className="w-[18px] h-[18px] text-white/35 hover:text-white/55 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {pendingTasks > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-gold flex items-center justify-center text-[8px] font-semibold text-black tabular-nums">
                {pendingTasks > 99 ? "99+" : pendingTasks}
              </span>
            )}
          </Link>
        )}
        {user && (
          <Link
            href="/profile"
            className="w-[30px] h-[30px] rounded-full border border-white/[0.12] bg-white/[0.06] flex items-center justify-center text-[10px] font-medium text-gold/80 hover:border-gold/30 hover:text-gold transition-all duration-300"
            aria-label="Profile"
          >
            {user.first_name[0]}{user.last_name[0]}
          </Link>
        )}
      </div>
    </header>
  );
}

