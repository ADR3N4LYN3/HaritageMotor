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
  const { events, isLoading: eventsLoading, mutate: mutateTimeline } = useVehicleTimeline(id);
  const { data: docsData, mutate: mutateDocs } = useSWR<PaginatedResponse<Document>>(
    id ? `/vehicles/${id}/documents` : null
  );
  const documents = docsData?.data || [];

  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deleteDocConfirm, setDeleteDocConfirm] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteType, setNoteType] = useState<"note_added" | "incident_reported">("note_added");
  const [noteText, setNoteText] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  const canOperate = role === "admin" || role === "operator";
  const canTechnician = canOperate || role === "technician";
  const isAdmin = role === "admin";

  async function handleDownload(docId: string) {
    setDownloadingDoc(docId);
    setErrorMsg(null);
    try {
      const res = await api.get<{ document: Document; signed_url: string }>(
        `/vehicles/${id}/documents/${docId}`
      );
      if (res.signed_url) {
        window.open(res.signed_url, "_blank");
      }
    } catch {
      setErrorMsg("Failed to download document. Please try again.");
    } finally {
      setDownloadingDoc(null);
    }
  }

  async function handleReport() {
    setReportLoading(true);
    setErrorMsg(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

      const doFetch = () => {
        const token = useAppStore.getState().accessToken;
        return fetch(`${apiUrl}/vehicles/${id}/report`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      };

      let res = await doFetch();

      // Handle 401 with refresh (same logic as api.ts)
      if (res.status === 401) {
        const refreshRes = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (data.access_token) {
            useAppStore.getState().setAccessToken(data.access_token);
            res = await doFetch();
          }
        }
      }

      if (!res.ok) throw new Error("Report generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `HeritageMotor_${vehicle?.make}_${vehicle?.model}_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMsg("Failed to generate report. Please try again.");
    } finally {
      setReportLoading(false);
    }
  }

  async function handleDeleteVehicle() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleteLoading(true);
    setErrorMsg(null);
    try {
      await api.delete(`/vehicles/${id}`);
      router.push("/dashboard");
    } catch {
      setErrorMsg("Failed to delete vehicle. Please try again.");
      setDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (deleteDocConfirm !== docId) {
      setDeleteDocConfirm(docId);
      return;
    }
    setDeletingDocId(docId);
    try {
      await api.delete(`/vehicles/${id}/documents/${docId}`);
      mutateDocs();
      setDeleteDocConfirm(null);
    } catch {
      setErrorMsg("Failed to delete document.");
    } finally {
      setDeletingDocId(null);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setNoteLoading(true);
    setErrorMsg(null);
    try {
      await api.post("/events", {
        vehicle_id: id,
        event_type: noteType,
        notes: noteText.trim(),
      });
      setNoteText("");
      setShowNoteForm(false);
      mutateTimeline();
    } catch {
      setErrorMsg("Failed to add note.");
    } finally {
      setNoteLoading(false);
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

        {/* Error feedback */}
        {errorMsg && (
          <p className="text-danger text-sm text-center">{errorMsg}</p>
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

        {/* Delete Vehicle — admin only */}
        {isAdmin && (
          <ActionButton
            variant="danger"
            onClick={handleDeleteVehicle}
            loading={deleteLoading}
          >
            {deleteConfirm ? "Confirm deletion" : "Delete Vehicle"}
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
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <button
                      onClick={() => handleDownload(doc.id)}
                      disabled={downloadingDoc === doc.id}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/60 text-xs hover:bg-white/[0.1] transition-colors disabled:opacity-50"
                    >
                      {downloadingDoc === doc.id ? "..." : "Download"}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        disabled={deletingDocId === doc.id}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs transition-colors ${
                          deleteDocConfirm === doc.id
                            ? "border-danger/40 bg-danger/10 text-danger"
                            : "border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-danger hover:border-danger/30"
                        }`}
                        aria-label={deleteDocConfirm === doc.id ? "Confirm delete" : "Delete document"}
                      >
                        {deleteDocConfirm === doc.id ? (
                          <span className="text-[10px] font-semibold">OK</span>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/30 uppercase tracking-wider">
              Timeline
            </h2>
            {canTechnician && (
              <button
                onClick={() => setShowNoteForm(!showNoteForm)}
                className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 text-xs hover:text-gold hover:border-gold/30 transition-all duration-300"
                style={{ transitionTimingFunction: "var(--ease-lux)" }}
              >
                {showNoteForm ? "Cancel" : "+ Add Note"}
              </button>
            )}
          </div>

          {/* Add note/incident form */}
          {showNoteForm && (
            <form onSubmit={handleAddNote} className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4 mb-3 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNoteType("note_added")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    noteType === "note_added"
                      ? "bg-gold/15 text-gold border-gold/30"
                      : "bg-white/[0.04] text-white/50 border-white/[0.06]"
                  }`}
                  aria-pressed={noteType === "note_added"}
                >
                  <svg className="w-3.5 h-3.5 inline -mt-px mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Note
                </button>
                <button
                  type="button"
                  onClick={() => setNoteType("incident_reported")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    noteType === "incident_reported"
                      ? "bg-danger/15 text-danger border-danger/30"
                      : "bg-white/[0.04] text-white/50 border-white/[0.06]"
                  }`}
                  aria-pressed={noteType === "incident_reported"}
                >
                  <svg className="w-3.5 h-3.5 inline -mt-px mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  Incident
                </button>
              </div>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={noteType === "note_added" ? "Add a note..." : "Describe the incident..."}
                rows={2}
                required
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none transition-colors"
              />
              <ActionButton type="submit" loading={noteLoading} disabled={!noteText.trim()} fullWidth={false} className="px-6">
                Add to Timeline
              </ActionButton>
            </form>
          )}
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
