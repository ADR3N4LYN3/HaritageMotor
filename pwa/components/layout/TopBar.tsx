"use client";

import Link from "next/link";
import { useAppStore } from "@/store/app.store";
import { SyncBadge } from "../ui/SyncBadge";
import { LangSwitcher } from "../ui/LangSwitcher";
import logoCrest from "@/public/logo-crest-v2.png";
import useSWR from "swr";

export function TopBar() {
  const user = useAppStore((s) => s.user);
  const { data: taskData } = useSWR<{ data: unknown[]; total_count: number }>(
    user ? "/tasks?status=pending&per_page=1" : null,
    { refreshInterval: 60000 }
  );
  const pendingTasks = taskData?.total_count ?? 0;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl text-white px-4 py-3 flex items-center justify-between safe-top border-b border-gold/10">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoCrest.src} alt="HM" className="h-[30px] w-auto flex-shrink-0" />
        <span className="font-display text-[13px] font-light tracking-[0.2em] uppercase text-gold">
          Heritage Motor
        </span>
      </div>
      <div className="flex items-center gap-3">
        <SyncBadge />
        <LangSwitcher />
        {user && (
          <Link href="/tasks" className="relative" aria-label="Pending tasks">
            <svg className="w-5 h-5 text-white/40 hover:text-white/60 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {pendingTasks > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-gold flex items-center justify-center text-[9px] font-semibold text-black tabular-nums">
                {pendingTasks > 99 ? "99+" : pendingTasks}
              </span>
            )}
          </Link>
        )}
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
