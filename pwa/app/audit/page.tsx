"use client";

import { useState, useMemo, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app.store";
import type { AuditEntry, PaginatedResponse } from "@/lib/types";
import useSWR from "swr";

const RESOURCE_FILTERS = ["", "vehicle", "bay", "task", "event", "user", "document"] as const;

const actionColors: Record<string, string> = {
  POST: "bg-success/10 text-success",
  PATCH: "bg-warning/10 text-warning",
  DELETE: "bg-danger/10 text-danger",
};

const resourceIcons: Record<string, string> = {
  vehicle: "\uD83D\uDE97",
  bay: "\uD83C\uDFEA",
  task: "\u2705",
  event: "\uD83D\uDCC5",
  user: "\uD83D\uDC64",
  document: "\uD83D\uDCC4",
};

export default function AuditPage() {
  const currentUser = useAppStore((s) => s.user);
  const isAdmin = currentUser?.role === "admin";

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
          Access restricted to administrators
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Audit Log" backHref="/dashboard" />

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
              {r ? `${resourceIcons[r] || ""} ${r.charAt(0).toUpperCase() + r.slice(1)}` : "All"}
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
            Failed to load audit log
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm font-light">
            No audit entries found
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
                      <span className="text-lg shrink-0">
                        {resourceIcons[entry.resource_type] || "\uD83D\uDCCC"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              actionColors[entry.action] || "bg-white/[0.06] text-white/50"
                            }`}
                          >
                            {entry.action}
                          </span>
                          <span className="text-sm text-white">
                            {entry.resource_type}
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
              Previous
            </button>
            <span className="text-xs text-white/40">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm border border-white/[0.08] bg-white/[0.04] text-white/50 disabled:opacity-30 transition-colors hover:text-gold hover:border-gold/30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
