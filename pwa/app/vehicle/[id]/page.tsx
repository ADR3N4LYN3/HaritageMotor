"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { EventItem } from "@/components/ui/EventItem";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useVehicle, useVehicleTimeline } from "@/hooks/useVehicle";
import { useAppStore } from "@/store/app.store";
import { api } from "@/lib/api";
import type { Document, PaginatedResponse } from "@/lib/types";
import useSWR from "swr";

export default function VehiclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const user = useAppStore((s) => s.user);
  const role = user?.role || "viewer";

  const { vehicle, isLoading } = useVehicle(id);
  const { events, isLoading: eventsLoading } = useVehicleTimeline(id);
  const { data: docsData } = useSWR<PaginatedResponse<Document>>(
    id ? `/vehicles/${id}/documents` : null
  );
  const documents = docsData?.data || [];

  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const canOperate = role === "admin" || role === "operator";
  const canTechnician = canOperate || role === "technician";

  async function handleDownload(docId: string) {
    setDownloadingDoc(docId);
    try {
      const res = await api.get<{ document: Document; signed_url: string }>(
        `/vehicles/${id}/documents/${docId}`
      );
      if (res.signed_url) {
        window.open(res.signed_url, "_blank");
      }
    } catch {
      // silently fail
    } finally {
      setDownloadingDoc(null);
    }
  }

  async function handleReport() {
    setReportLoading(true);
    try {
      const token = useAppStore.getState().accessToken;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
      const res = await fetch(`${apiUrl}/vehicles/${id}/report`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Report generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `HeritageMotor_${vehicle?.make}_${vehicle?.model}_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setReportLoading(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <VehicleCardSkeleton />
          <div className="skeleton h-8 w-32" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!vehicle) {
    return (
      <AppShell>
        <div className="text-center py-12 text-white/50">
          Vehicle not found
        </div>
      </AppShell>
    );
  }

  const displayName = `${vehicle.make} ${vehicle.model}`;
  const subtitle = [vehicle.color, vehicle.year].filter(Boolean).join(" · ");

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Vehicle Header */}
        <PageHeader
          title={displayName}
          subtitle={subtitle}
          backHref="/dashboard"
          action={canOperate ? (
            <button
              onClick={() => router.push(`/vehicle/${id}/edit`)}
              className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 text-xs hover:text-gold hover:border-gold/30 transition-all duration-300"
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            >
              Edit
            </button>
          ) : undefined}
        />
        <div className="bg-white/[0.025] rounded-xl p-5 border border-white/[0.05] gold-border-top">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              vehicle.status === "stored"
                ? "bg-success/10 text-success"
                : vehicle.status === "maintenance"
                ? "bg-warning/10 text-warning"
                : "bg-white/10 text-white/50"
            }`}>
              {vehicle.status}
            </span>
            <span className="text-sm text-white/50">
              {vehicle.owner_name}
            </span>
          </div>
          {vehicle.license_plate && (
            <div className="mt-3 inline-block bg-white/[0.06] px-3 py-1 rounded-lg text-sm font-mono text-white/70">
              {vehicle.license_plate}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {vehicle.status === "stored" && (
          <div className="space-y-2">
            {canOperate && (
              <ActionButton onClick={() => router.push(`/vehicle/${id}/move`)}>
                Move Vehicle
              </ActionButton>
            )}
            {canTechnician && (
              <ActionButton
                variant="secondary"
                onClick={() => router.push(`/vehicle/${id}/task`)}
              >
                Maintenance Tasks
              </ActionButton>
            )}
            {canTechnician && (
              <ActionButton
                variant="secondary"
                onClick={() => router.push(`/vehicle/${id}/photo`)}
              >
                Add Photo
              </ActionButton>
            )}
            {canOperate && (
              <ActionButton
                variant="danger"
                onClick={() => router.push(`/vehicle/${id}/exit`)}
              >
                Exit Vehicle
              </ActionButton>
            )}
          </div>
        )}

        {/* PDF Report */}
        {canOperate && (
          <ActionButton
            variant="secondary"
            onClick={handleReport}
            loading={reportLoading}
          >
            {reportLoading ? "Generating report..." : "Generate PDF Report"}
          </ActionButton>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
              Documents
            </h2>
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] divide-y divide-white/[0.06]">
              {documents.map((doc) => (
                <div key={doc.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{doc.filename}</p>
                    <p className="text-xs text-white/30 mt-0.5">
                      {doc.doc_type} · {(doc.size_bytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownload(doc.id)}
                    disabled={downloadingDoc === doc.id}
                    className="ml-3 px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/60 text-xs hover:bg-white/[0.1] transition-colors disabled:opacity-50"
                  >
                    {downloadingDoc === doc.id ? "..." : "Download"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <h2 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            Timeline
          </h2>
          {eventsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="text-center text-sm text-white/30 py-4">No events yet</p>
          ) : (
            <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
              {events.map((event) => (
                <EventItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
