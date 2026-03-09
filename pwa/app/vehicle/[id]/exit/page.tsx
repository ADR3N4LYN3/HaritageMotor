"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { ActionButton } from "@/components/ui/ActionButton";
import { PhotoGrid } from "@/components/camera/PhotoGrid";
import { SuccessScreen } from "@/components/ui/SuccessScreen";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useVehicle } from "@/hooks/useVehicle";
import { useCamera } from "@/hooks/useCamera";
import { api } from "@/lib/api";

const CameraCapture = dynamic(
  () =>
    import("@/components/camera/CameraCapture").then((mod) => ({
      default: mod.CameraCapture,
    })),
  { ssr: false, loading: () => <div className="h-12 bg-neutral-100 animate-pulse rounded-xl" /> }
);

const REQUIRED_PHOTOS = 2;

const checklistItems = [
  { id: "exterior", label: "Exterior verified" },
  { id: "no_damage", label: "No visible damage" },
  { id: "docs_handed", label: "Documents handed over" },
];

export default function ExitVehiclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { vehicle, isLoading } = useVehicle(id);
  const { photos, addPhoto, removePhoto } = useCamera();

  const [step, setStep] = useState<"warning" | "form">("warning");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = checklistItems.every((item) => checklist[item.id]);
  const canConfirm = photos.length >= REQUIRED_PHOTOS && allChecked && recipient.trim() !== "";

  async function handleExit() {
    if (!canConfirm) return;
    setLoading(true);
    setError(null);
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
      await api.post(`/vehicles/${id}/exit`, {
        recipient_name: recipient,
        notes: notes || undefined,
        checklist: checklistItems.filter((c) => checklist[c.id]).map((c) => c.id),
      });

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Exit failed");
    } finally {
      setLoading(false);
    }
  }

  if (success && vehicle) {
    return (
      <SuccessScreen
        title={`${vehicle.make} ${vehicle.model}`}
        subtitle="Vehicle Exit Complete"
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
        <p className="text-center text-black/50 py-12">Vehicle not found</p>
      </AppShell>
    );
  }

  // Warning Step
  if (step === "warning") {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-black">
              Vehicle Exit
            </h2>
            <p className="text-black/50 mt-2 text-sm">
              This action is irreversible. The vehicle will be marked as exited.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5 w-full">
            <h3 className="font-display text-lg font-semibold">
              {vehicle.make} {vehicle.model}
            </h3>
            <p className="text-sm text-black/50 mt-0.5">
              {vehicle.color}{vehicle.year ? ` · ${vehicle.year}` : ""}
            </p>
          </div>
          <div className="w-full space-y-2">
            <ActionButton variant="danger" onClick={() => setStep("form")}>
              Proceed with Exit
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => router.back()}>
              Cancel
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
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
          <h2 className="font-display text-xl font-semibold text-black">
            {vehicle.make} {vehicle.model}
          </h2>
          <p className="text-sm text-danger font-medium mt-1">Exit Procedure</p>
        </div>

        {/* Exit Photos */}
        <div>
          <h3 className="text-sm font-semibold text-black/40 uppercase tracking-wider mb-3">
            Exit Photos
          </h3>
          <CameraCapture onCapture={addPhoto} multiple label="Take exit photo" />
          {photos.length > 0 && (
            <div className="mt-3">
              <PhotoGrid photos={photos} required={REQUIRED_PHOTOS} onRemove={removePhoto} />
            </div>
          )}
        </div>

        {/* Checklist */}
        <div>
          <h3 className="text-sm font-semibold text-black/40 uppercase tracking-wider mb-3">
            Checklist
          </h3>
          <div className="space-y-2">
            {checklistItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setChecklist((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-black/5 touch-target"
              >
                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                  checklist[item.id]
                    ? "bg-success border-success"
                    : "border-black/20"
                }`}>
                  {checklist[item.id] && (
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-black">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recipient */}
        <div>
          <h3 className="text-sm font-semibold text-black/40 uppercase tracking-wider mb-3">
            Recipient
          </h3>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Transporter / owner name"
            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-gold/50 text-sm"
          />
        </div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-gold/50 text-sm resize-none"
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
            Confirm Exit
          </ActionButton>
          {!canConfirm && (
            <p className="text-xs text-black/40 text-center mt-2">
              {photos.length < REQUIRED_PHOTOS && `${REQUIRED_PHOTOS - photos.length} more photo${REQUIRED_PHOTOS - photos.length > 1 ? "s" : ""} needed · `}
              {!allChecked && "Complete checklist · "}
              {!recipient.trim() && "Enter recipient"}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
