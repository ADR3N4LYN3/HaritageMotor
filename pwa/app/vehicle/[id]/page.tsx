"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ActionButton } from "@/components/ui/ActionButton";
import { EventItem } from "@/components/ui/EventItem";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useVehicle, useVehicleTimeline } from "@/hooks/useVehicle";
import { useAppStore } from "@/store/app.store";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { vehicleDetailI18n } from "@/lib/translations";
import type { Document, PaginatedResponse } from "@/lib/types";
import useSWR from "swr";

export default function VehiclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const user = useAppStore((s) => s.user);
  const role = user?.role || "viewer";
  const { t } = useI18n(vehicleDetailI18n);

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
  const [heroUrl, setHeroUrl] = useState<string | null>(null);

  const canOperate = role === "admin" || role === "operator";
  const canTechnician = canOperate || role === "technician";
  const isAdmin = role === "admin";

  // Extract first photo from events for hero image
  const firstPhotoKey = useMemo(() => {
    if (!events) return null;
    for (const ev of events) {
      if (ev.photo_keys && ev.photo_keys.length > 0) {
        return ev.photo_keys[0];
      }
    }
    return null;
  }, [events]);

  // Count total photos
  const photoCount = useMemo(() => {
    if (!events) return 0;
    return events.reduce((sum, ev) => sum + (ev.photo_keys?.length || 0), 0);
  }, [events]);

  // Fetch signed URL for hero photo
  useEffect(() => {
    if (!firstPhotoKey) { setHeroUrl(null); return; }
    const encodedKey = btoa(firstPhotoKey);
    api.get<{ signed_url: string }>(`/photos/${encodedKey}/signed-url`)
      .then((res) => setHeroUrl(res.signed_url))
      .catch(() => setHeroUrl(null));
  }, [firstPhotoKey]);

  async function handleDownload(docId: string) {
    setDownloadingDoc(docId);
    setErrorMsg(null);
    try {
      const res = await api.get<{ document: Document; signed_url: string }>(
        `/vehicles/${id}/documents/${docId}`
      );
      if (res.signed_url) window.open(res.signed_url, "_blank");
    } catch {
      setErrorMsg(t.failedDownload);
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
      if (res.status === 401) {
        const refreshRes = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
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
      setErrorMsg(t.failedReport);
    } finally {
      setReportLoading(false);
    }
  }

  async function handleDeleteVehicle() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleteLoading(true);
    setErrorMsg(null);
    try {
      await api.delete(`/vehicles/${id}`);
      router.push("/dashboard");
    } catch {
      setErrorMsg(t.failedDelete);
      setDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (deleteDocConfirm !== docId) { setDeleteDocConfirm(docId); return; }
    setDeletingDocId(docId);
    try {
      await api.delete(`/vehicles/${id}/documents/${docId}`);
      mutateDocs();
      setDeleteDocConfirm(null);
    } catch {
      setErrorMsg(t.failedDeleteDoc);
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
      await api.post("/events", { vehicle_id: id, event_type: noteType, notes: noteText.trim() });
      setNoteText("");
      setShowNoteForm(false);
      mutateTimeline();
    } catch {
      setErrorMsg(t.failedAddNote);
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
        <div className="text-center py-12 text-white/50">{t.notFound}</div>
      </AppShell>
    );
  }

  const statusStyles: Record<string, string> = {
    stored: "bg-success/12 text-success",
    maintenance: "bg-warning/12 text-warning",
    out: "bg-white/10 text-white/50",
    transit: "bg-[#3b82f6]/12 text-[#3b82f6]",
  };

  return (
    <AppShell>
      <div className="space-y-5">
        {/* ── Hero Section ── */}
        <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]">
          {/* Photo or fallback */}
          {heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroUrl}
              alt={`${vehicle.make} ${vehicle.model}`}
              className="w-full h-[240px] sm:h-[280px] object-cover"
              style={{ filter: "brightness(0.65)" }}
            />
          ) : (
            <div className="w-full h-[200px] sm:h-[240px] bg-gradient-to-br from-dark-2 to-dark flex items-center justify-center">
              <svg className="w-16 h-16 text-white/[0.07]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a1 1 0 0 1 .4-.8l3-2.4A2 2 0 0 1 7.6 5h8.8a2 2 0 0 1 1.2.4l3 2.4a1 1 0 0 1 .4.8v6a2 2 0 0 1-2 2M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M9 17h6" />
              </svg>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" style={{ background: "linear-gradient(to top, #0e0d0b 0%, rgba(14,13,11,0.8) 35%, rgba(14,13,11,0.25) 65%, transparent 100%)" }} />

          {/* Nav buttons */}
          <div className="absolute top-3 left-3 right-3 z-10 flex justify-between">
            <button
              onClick={() => router.push("/dashboard")}
              className="w-10 h-10 rounded-full border border-white/[0.15] bg-black/50 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-gold hover:border-gold/30 transition-all active:scale-95"
              aria-label="Back"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            {canOperate && (
              <button
                onClick={() => router.push(`/vehicle/${id}/edit`)}
                className="px-3.5 py-2 rounded-lg border border-white/[0.15] bg-black/50 backdrop-blur-md text-white/60 text-xs font-medium tracking-wide hover:text-gold hover:border-gold/30 transition-all"
              >
                {t.edit}
              </button>
            )}
          </div>

          {/* Vehicle info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 z-10">
            <h1 className="text-[1.5rem] sm:text-[1.75rem] font-light tracking-[0.03em] text-white leading-[1.2]">
              {vehicle.make} {vehicle.model}
            </h1>
            <p className="text-[0.82rem] text-white/40 font-light mt-1">
              {[vehicle.color, vehicle.year].filter(Boolean).join(" · ")}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[0.65rem] font-medium px-2.5 py-0.5 rounded-full uppercase tracking-[0.05em] ${statusStyles[vehicle.status] || "bg-white/10 text-white/50"}`}>
                {vehicle.status}
              </span>
              <span className="text-[0.8rem] text-white/50">{vehicle.owner_name}</span>
              {vehicle.license_plate && (
                <span className="text-[0.72rem] font-mono bg-white/[0.08] px-2 py-0.5 rounded text-white/60 tracking-wide">
                  {vehicle.license_plate}
                </span>
              )}
            </div>
            {vehicle.tags && vehicle.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {vehicle.tags.map((tag) => (
                  <span key={tag} className="text-[0.62rem] tracking-[0.04em] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/45 border border-white/[0.06]">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Photo count badge */}
          {photoCount > 0 && (
            <button
              onClick={() => router.push(`/vehicle/${id}/photo`)}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 text-[0.68rem] text-white/60 bg-black/50 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/[0.1] hover:text-gold hover:border-gold/30 transition-all"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              {photoCount}
            </button>
          )}
        </div>

        {/* ── Quick Actions Grid ── */}
        {vehicle.status === "stored" && (
          <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
            {canOperate && (
              <button onClick={() => router.push(`/vehicle/${id}/move`)} className="bg-gold/[0.06] border border-gold/[0.2] rounded-xl p-3 flex flex-col items-center gap-2 hover:border-gold/40 transition-all active:scale-95 group">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center text-gold/70">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </div>
                <span className="text-[0.68rem] text-white/60 group-hover:text-white/80 transition-colors">{t.move}</span>
              </button>
            )}
            {canTechnician && (
              <button onClick={() => router.push(`/vehicle/${id}/task`)} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex flex-col items-center gap-2 hover:border-gold/20 transition-all active:scale-95 group">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center text-gold/70">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                </div>
                <span className="text-[0.68rem] text-white/60 group-hover:text-white/80 transition-colors">{t.tasks}</span>
              </button>
            )}
            {canTechnician && (
              <button onClick={() => router.push(`/vehicle/${id}/photo`)} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex flex-col items-center gap-2 hover:border-gold/20 transition-all active:scale-95 group">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center text-gold/70">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                </div>
                <span className="text-[0.68rem] text-white/60 group-hover:text-white/80 transition-colors">{t.photo}</span>
              </button>
            )}
            {canOperate && (
              <button onClick={() => router.push(`/vehicle/${id}/exit`)} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex flex-col items-center gap-2 hover:border-danger/20 transition-all active:scale-95 group">
                <div className="w-9 h-9 rounded-lg bg-danger/10 border border-danger/15 flex items-center justify-center text-danger/70">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 19V7M5 12l7-7 7 7" /><line x1="5" y1="3" x2="19" y2="3" /></svg>
                </div>
                <span className="text-[0.68rem] text-danger/60 group-hover:text-danger/80 transition-colors">{t.exit}</span>
              </button>
            )}
          </div>
        )}

        {/* Error feedback */}
        {errorMsg && <p className="text-danger text-sm text-center">{errorMsg}</p>}

        {/* ── Desktop 2-col / Mobile stacked ── */}
        <div className="lg:grid lg:grid-cols-[1fr_1fr] lg:gap-6">
          {/* Left column: Info + Documents + Secondary actions */}
          <div className="space-y-5">
            {/* Vehicle Info */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-white/30 mb-3">{t.vehicleInfo}</p>
              {[
                [t.make, vehicle.make],
                [t.model, vehicle.model],
                [t.year, vehicle.year],
                [t.color, vehicle.color],
                [t.vin, vehicle.vin],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="flex justify-between items-baseline py-1.5 border-b border-white/[0.04] last:border-0">
                  <span className="text-[0.78rem] text-white/35">{label}</span>
                  <span className="text-[0.78rem] text-white/80 font-light">{value}</span>
                </div>
              ))}
            </div>

            {/* Owner Info */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-white/30 mb-3">{t.owner}</p>
              {[
                [t.name, vehicle.owner_name],
                [t.email, vehicle.owner_email],
                [t.phone, vehicle.owner_phone],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="flex justify-between items-baseline py-1.5 border-b border-white/[0.04] last:border-0">
                  <span className="text-[0.78rem] text-white/35">{label}</span>
                  <span className="text-[0.78rem] text-white/80 font-light">{value}</span>
                </div>
              ))}
            </div>

            {/* Documents */}
            {documents.length > 0 && (
              <div>
                <h2 className="text-[0.65rem] font-semibold text-white/30 uppercase tracking-[0.15em] mb-2">{t.documents}</h2>
                <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] divide-y divide-white/[0.04]">
                  {documents.map((doc) => (
                    <div key={doc.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">{doc.filename}</p>
                        <p className="text-xs text-white/30 mt-0.5">{doc.doc_type} · {(doc.size_bytes / 1024).toFixed(0)} KB</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <button onClick={() => handleDownload(doc.id)} disabled={downloadingDoc === doc.id} className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/60 text-xs hover:bg-white/[0.1] transition-colors disabled:opacity-50">
                          {downloadingDoc === doc.id ? "..." : t.download}
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            disabled={deletingDocId === doc.id}
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs transition-colors ${deleteDocConfirm === doc.id ? "border-danger/40 bg-danger/10 text-danger" : "border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-danger hover:border-danger/30"}`}
                            aria-label={deleteDocConfirm === doc.id ? "Confirm delete" : "Delete document"}
                          >
                            {deleteDocConfirm === doc.id ? <span className="text-[10px] font-semibold">OK</span> : (
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Secondary actions */}
            <div className="flex gap-2">
              {canOperate && (
                <button onClick={handleReport} disabled={reportLoading} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/50 text-[0.78rem] hover:text-gold hover:border-gold/30 transition-all disabled:opacity-50">
                  {reportLoading ? t.generating : t.pdfReport}
                </button>
              )}
              {isAdmin && (
                <button onClick={handleDeleteVehicle} disabled={deleteLoading} className="flex-1 py-2.5 rounded-xl border border-danger/15 bg-danger/[0.04] text-danger/60 text-[0.78rem] hover:text-danger hover:border-danger/30 transition-all disabled:opacity-50">
                  {deleteConfirm ? t.confirm : t.delete}
                </button>
              )}
            </div>
          </div>

          {/* Right column: Timeline */}
          <div className="mt-5 lg:mt-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[0.65rem] font-semibold text-white/30 uppercase tracking-[0.15em]">{t.timeline}</h2>
              {canTechnician && (
                <button
                  onClick={() => setShowNoteForm(!showNoteForm)}
                  className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 text-xs hover:text-gold hover:border-gold/30 transition-all duration-300"
                >
                  {showNoteForm ? t.cancel : t.addNote}
                </button>
              )}
            </div>

            {/* Note form */}
            {showNoteForm && (
              <form onSubmit={handleAddNote} className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4 mb-3 space-y-3">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setNoteType("note_added")} aria-pressed={noteType === "note_added"} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${noteType === "note_added" ? "bg-gold/15 text-gold border-gold/30" : "bg-white/[0.03] text-white/50 border-white/[0.06]"}`}>
                    <svg className="w-3.5 h-3.5 inline -mt-px mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    {t.note}
                  </button>
                  <button type="button" onClick={() => setNoteType("incident_reported")} aria-pressed={noteType === "incident_reported"} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${noteType === "incident_reported" ? "bg-danger/15 text-danger border-danger/30" : "bg-white/[0.03] text-white/50 border-white/[0.06]"}`}>
                    <svg className="w-3.5 h-3.5 inline -mt-px mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    {t.incident}
                  </button>
                </div>
                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={noteType === "note_added" ? t.addNotePlaceholder : t.describeIncident} rows={2} required className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none transition-colors" />
                <ActionButton type="submit" loading={noteLoading} disabled={!noteText.trim()} fullWidth={false} className="px-6">{t.addToTimeline}</ActionButton>
              </form>
            )}

            {eventsLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="skeleton h-16 rounded-xl" />)}</div>
            ) : events.length === 0 ? (
              <p className="text-center text-sm text-white/30 py-6">{t.noEvents}</p>
            ) : (
              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4">
                {events.map((event) => <EventItem key={event.id} event={event} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
