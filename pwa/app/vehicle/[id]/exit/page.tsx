"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { PhotoGrid } from "@/components/camera/PhotoGrid";
import { SuccessScreen } from "@/components/ui/SuccessScreen";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useVehicle } from "@/hooks/useVehicle";
import { useCamera } from "@/hooks/useCamera";
import { api, ApiError } from "@/lib/api";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { pushAction } from "@/lib/offline-queue";
import { useI18n } from "@/lib/i18n";
import { vehicleExitI18n } from "@/lib/translations";

const CameraCapture = dynamic(
  () =>
    import("@/components/camera/CameraCapture").then((mod) => ({
      default: mod.CameraCapture,
    })),
  { ssr: false, loading: () => <div className="h-12 bg-white/[0.04] animate-pulse rounded-xl" /> }
);

const REQUIRED_PHOTOS = 2;

const CHECKLIST_IDS = ["exterior", "no_damage", "docs_handed"] as const;

export default function ExitVehiclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { t } = useI18n(vehicleExitI18n);
  const { vehicle, isLoading } = useVehicle(id);
  const { photos, addPhoto, removePhoto } = useCamera();
  const { refreshCount } = useOfflineQueue();

  const checklistItems = [
    { id: "exterior", label: t.exteriorVerified },
    { id: "no_damage", label: t.noDamage },
    { id: "docs_handed", label: t.docsHandedOver },
  ];

  const [step, setStep] = useState<"warning" | "form">("warning");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = CHECKLIST_IDS.every((id) => checklist[id]);
  const canConfirm = photos.length >= REQUIRED_PHOTOS && allChecked && recipient.trim() !== "";

  async function handleExit() {
    if (!canConfirm) return;
    setLoading(true);
    setError(null);

    const payload = {
      recipient_name: recipient,
      notes: notes || undefined,
      checklist: CHECKLIST_IDS.filter((cid) => checklist[cid]),
    };

    // Offline fallback — queue for later sync (photos can't be serialized)
    if (!navigator.onLine) {
      try {
        await pushAction({ type: "exit", vehicle_id: id, payload, photos: [] });
        await refreshCount();
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setSuccess(true);
      } catch {
        setError("Failed to queue action offline");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      // Upload exit photos in parallel
      const results = await Promise.allSettled(photos.map((photo) => {
        const formData = new FormData();
        formData.append("file", photo.file);
        formData.append("doc_type", "other");
        formData.append("notes", "Exit photo");
        return api.upload(`/vehicles/${id}/documents`, formData);
      }));
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        throw new Error(`${failed.length} photo(s) failed to upload`);
      }

      // Execute exit
      await api.post(`/vehicles/${id}/exit`, payload);

      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      setSuccess(true);
    } catch (err: unknown) {
      // Network error on exit API call — queue for offline sync
      if (!(err instanceof ApiError)) {
        try {
          await pushAction({ type: "exit", vehicle_id: id, payload, photos: [] });
          await refreshCount();
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          setSuccess(true);
          return;
        } catch { /* fall through */ }
      }
      setError(err instanceof Error ? err.message : "Exit failed");
    } finally {
      setLoading(false);
    }
  }

  if (success && vehicle) {
    return (
      <SuccessScreen
        title={`${vehicle.make} ${vehicle.model}`}
        subtitle={t.exitComplete}
        onDone={() => router.push("/scan")}
      />
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <VehicleCardSkeleton />
      </AppShell>
    );
  }

  if (!vehicle) {
    return (
      <AppShell>
        <p className="text-center text-white/50 py-12">{t.notFound}</p>
      </AppShell>
    );
  }

  // Warning Step
  if (step === "warning") {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <PageHeader
            title={t.title}
            subtitle={t.irreversible}
            backHref={`/vehicle/${id}`}
          />
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white/50 text-sm">
              {t.markedExited}
            </p>
          </div>
          <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] w-full">
            <h3 className="text-[1rem] font-normal text-white">
              {vehicle.make} {vehicle.model}
            </h3>
            <p className="text-sm text-white/50 mt-0.5">
              {vehicle.color}{vehicle.year ? ` · ${vehicle.year}` : ""}
            </p>
          </div>
          <div className="w-full space-y-2">
            <ActionButton variant="danger" onClick={() => setStep("form")}>
              {t.proceedExit}
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => router.back()}>
              {t.cancel}
            </ActionButton>
          </div>
        </div>
      </AppShell>
    );
  }

  // Form Step
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t.exitProcedure}
          subtitle={`${vehicle.make} ${vehicle.model}`}
          backHref={`/vehicle/${id}`}
        />

        {/* Exit Photos */}
        <div>
          <h3 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            {t.exitPhotos}
          </h3>
          <CameraCapture onCapture={addPhoto} multiple label={t.takeExitPhoto} />
          {photos.length > 0 && (
            <div className="mt-3">
              <PhotoGrid photos={photos} required={REQUIRED_PHOTOS} onRemove={removePhoto} />
            </div>
          )}
        </div>

        {/* Checklist */}
        <div>
          <h3 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            {t.checklist}
          </h3>
          <div className="space-y-2">
            {checklistItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setChecklist((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] touch-target"
              >
                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                  checklist[item.id]
                    ? "bg-success border-success"
                    : "border-white/20"
                }`}>
                  {checklist[item.id] && (
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-white">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recipient */}
        <div>
          <h3 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            {t.recipient}
          </h3>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={t.recipientPlaceholder}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm transition-colors"
          />
        </div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t.notesPlaceholder}
          rows={2}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm resize-none transition-colors"
        />

        {error && (
          <p className="text-danger text-sm text-center">{error}</p>
        )}

        {/* Confirm */}
        <div className="pb-4">
          <ActionButton
            variant="danger"
            onClick={handleExit}
            loading={loading}
            disabled={!canConfirm}
          >
            {t.confirmExit}
          </ActionButton>
          {!canConfirm && (
            <p className="text-xs text-white/40 text-center mt-2">
              {photos.length < REQUIRED_PHOTOS && `${REQUIRED_PHOTOS - photos.length} ${REQUIRED_PHOTOS - photos.length > 1 ? t.morePhotosPlural : t.morePhotos} · `}
              {!allChecked && `${t.completeChecklist} · `}
              {!recipient.trim() && t.enterRecipient}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
