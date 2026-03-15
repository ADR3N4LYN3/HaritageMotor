"use client";

import { useState, useMemo, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app.store";
import { useI18n } from "@/lib/i18n";
import { auditI18n } from "@/lib/translations";
import type { AuditEntry, PaginatedResponse } from "@/lib/types";
import useSWR from "swr";

const RESOURCE_FILTERS = ["", "vehicle", "bay", "task", "event", "user", "document"] as const;

function actionColor(action: string): string {
  if (action.includes("delete")) return "bg-danger/10 text-danger";
  if (action.includes("create") || action.includes("upload")) return "bg-success/10 text-success";
  if (action.includes("update") || action.includes("move") || action.includes("exit") || action.includes("complete")) return "bg-warning/10 text-warning";
  return "bg-white/[0.06] text-white/50";
}

function ResourceIcon({ type, className }: { type: string; className?: string }) {
  const cls = className || "w-4 h-4";
  const props = { className: cls, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "vehicle":
      return (<svg {...props}><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /><path d="M5 18H3V11l2-5h10l2 5h2a2 2 0 0 1 2 2v3h-2" /><path d="M5 11h14" /><path d="M9 18h6" /></svg>);
    case "bay":
      return (<svg {...props}><path d="M3 21V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16" /><path d="M3 21h18" /><path d="M9 3v18" /><path d="M15 3v18" /><path d="M3 12h18" /></svg>);
    case "task":
      return (<svg {...props}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>);
    case "event":
      return (<svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" /></svg>);
    case "user":
      return (<svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>);
    case "document":
      return (<svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></svg>);
    default:
      return (<svg {...props}><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>);
  }
}

export default function AuditPage() {
  const currentUser = useAppStore((s) => s.user);
  const isAdmin = currentUser?.role === "admin";
  const { t } = useI18n(auditI18n);

  const resourceLabels: Record<string, string> = {
    "": t.all, vehicle: t.vehicle, bay: t.bay, task: t.task,
    event: t.event, user: t.user, document: t.document,
  };

  const [resourceFilter, setResourceFilter] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const queryParams = new URLSearchParams();
  if (resourceFilter) queryParams.set("resource_type", resourceFilter);
  queryParams.set("page", String(page));
  queryParams.set("per_page", String(perPage));

  const { data, isLoading, error } = useSWR<PaginatedResponse<AuditEntry>>(
    `/audit?${queryParams.toString()}`,
    { refreshInterval: 30000 }
  );
  const entries = useMemo(() => data?.data || [], [data]);
  const totalCount = data?.total_count || 0;
  const totalPages = Math.ceil(totalCount / perPage);

  const handleFilterChange = useCallback((resource: string) => {
    setResourceFilter(resource);
    setPage(1);
  }, []);

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="text-center py-20 text-white/30 text-sm font-light">
          {t.restricted}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title={t.title} backHref="/dashboard" />

        {/* Resource type filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {RESOURCE_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => handleFilterChange(r)}
              aria-pressed={resourceFilter === r}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                resourceFilter === r
                  ? "bg-gold/15 text-gold border-gold/30"
                  : "bg-white/[0.04] text-white/50 border-white/[0.06]"
              }`}
            >
              {r ? (
                <span className="inline-flex items-center gap-1.5">
                  <ResourceIcon type={r} className="w-3.5 h-3.5" />
                  {resourceLabels[r]}
                </span>
              ) : t.all}
            </button>
          ))}
        </div>

        {/* Entries */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="skeleton h-16 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-danger text-sm font-light">
            {t.failedLoad}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm font-light">
            {t.noEntries}
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const date = new Date(entry.occurred_at);
              return (
                <div
                  key={entry.id}
                  className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0 text-gold/70">
                        <ResourceIcon type={entry.resource_type} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${actionColor(entry.action)}`}
                          >
                            {entry.action}
                          </span>
                          <span className="text-sm text-white">
                            {resourceLabels[entry.resource_type] || entry.resource_type}
                          </span>
                          {entry.resource_id && (
                            <span className="text-xs text-white/30 font-mono truncate max-w-[120px]">
                              {entry.resource_id.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-white/30">
                          {entry.ip_address && (
                            <span>{entry.ip_address}</span>
                          )}
                          {entry.request_id && (
                            <span className="font-mono truncate max-w-[80px]">
                              req:{entry.request_id.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-white/40">
                        {date.toLocaleDateString()}
                      </p>
                      <p className="text-xs text-white/30">
                        {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-white/[0.08] bg-white/[0.04] text-white/50 disabled:opacity-30 transition-colors hover:text-gold hover:border-gold/30"
            >
              {t.previous}
            </button>
            <span className="text-xs text-white/40">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm border border-white/[0.08] bg-white/[0.04] text-white/50 disabled:opacity-30 transition-colors hover:text-gold hover:border-gold/30"
            >
              {t.next}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
