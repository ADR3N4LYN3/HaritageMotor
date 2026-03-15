"use client";

import useSWR from "swr";
import { useI18n } from "@/lib/i18n";
import { activityI18n } from "@/lib/translations";
import type { ActivityEntry, PaginatedResponse } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function ActivityFeed({ active = true }: { active?: boolean }) {
  const { t } = useI18n(activityI18n);
  const { data, isLoading } = useSWR<PaginatedResponse<ActivityEntry>>(
    active ? "/activity?per_page=20" : null,
    { refreshInterval: 30000 }
  );

  const entries = data?.data || [];

  function formatAction(action: string): string {
    const parts = action.split(".");
    if (parts.length === 2) {
      const [resource, verb] = parts;
      const verbMap: Record<string, string> = {
        create: t.created,
        update: t.updated,
        delete: t.deleted,
        move: t.moved,
        exit: t.exited,
        complete: t.completed,
        upload: t.uploaded,
      };
      return `${verbMap[verb] || verb} ${resource}`;
    }
    return action;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="flex gap-3 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-white/10 mt-2 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-white/[0.06] rounded w-3/4" />
              <div className="h-2.5 bg-white/[0.04] rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/20 text-xs tracking-wider uppercase">{t.noActivity}</p>
      </div>
    );
  }

  return (
    <div className="relative pl-3.5 border-l border-gold/10">
      {entries.map((entry, i) => (
        <div key={entry.id} className="relative pb-5 last:pb-0">
          {/* Timeline dot */}
          <div
            className={`absolute -left-[18px] top-1.5 w-2 h-2 rounded-full ${
              i === 0
                ? "bg-gold shadow-[0_0_10px_rgba(184,149,90,0.4)]"
                : "bg-gold/20 border border-gold/15"
            }`}
          />
          <p className={`text-[12.5px] leading-relaxed break-words ${
            i === 0 ? "text-white/80 font-normal" : "text-white/55 font-light"
          }`}>
            <span className="text-white/70 font-medium">{entry.user_name.trim() || t.system}</span>
            {" "}
            {formatAction(entry.action)}
          </p>
          <div className="flex gap-2 mt-1">
            <span className="text-[10px] text-white/20">{timeAgo(entry.occurred_at)}</span>
            {entry.resource_type && (
              <span className="text-[10px] text-gold/30 font-medium uppercase tracking-wide">
                {entry.resource_type}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
