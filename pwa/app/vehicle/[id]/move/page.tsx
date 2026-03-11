"use client";

import { useState, useReducer } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { BaySelector } from "@/components/ui/BaySelector";
import { SuccessScreen } from "@/components/ui/SuccessScreen";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useVehicle } from "@/hooks/useVehicle";
import { useBays } from "@/hooks/useBay";
import { useCamera } from "@/hooks/useCamera";
import { api, ApiError } from "@/lib/api";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { pushAction } from "@/lib/offline-queue";
import type { Bay } from "@/lib/types";

const CameraCapture = dynamic(
  () =>
    import("@/components/camera/CameraCapture").then((mod) => ({
      default: mod.CameraCapture,
    })),
  { ssr: false, loading: () => <div className="h-12 bg-white/[0.04] animate-pulse rounded-xl" /> }
);

export default function MoveVehiclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { vehicle, isLoading: vehicleLoading } = useVehicle(id);
  const { bays, isLoading: baysLoading } = useBays();
  const { photos, addPhoto, removePhoto } = useCamera();
  const { refreshCount } = useOfflineQueue();

  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [notes, setNotes] = useState("");
  const [{ loading, success, error }, setStatus] = useReducer(
    (s: { loading: boolean; success: boolean; error: string | null }, a: Partial<{ loading: boolean; success: boolean; error: string | null }>) => ({ ...s, ...a }),
    { loading: false, success: false, error: null as string | null }
  );

  async function handleMove() {
    if (!selectedBay) return;
    setStatus({ loading: true, error: null });

    const payload = { bay_id: selectedBay.id, reason: notes || undefined };

    // Offline fallback — queue for later sync
    if (!navigator.onLine) {
      try {
        await pushAction({ type: "move", vehicle_id: id, payload, photos: [] });
        await refreshCount();
        if (navigator.vibrate) navigator.vibrate(100);
        setStatus({ success: true });
      } catch {
        setStatus({ error: "Failed to queue action offline" });
      } finally {
        setStatus({ loading: false });
      }
      return;
    }

    try {
      await api.post(`/vehicles/${id}/move`, payload);

      // Upload photos in parallel if any
      if (photos.length > 0) {
        const results = await Promise.allSettled(photos.map((photo) => {
          const formData = new FormData();
          formData.append("file", photo.file);
          formData.append("doc_type", "other");
          formData.append("notes", "Move photo");
          return api.upload(`/vehicles/${id}/documents`, formData);
        }));
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length > 0) {
          throw new Error(`${failed.length} photo(s) failed to upload`);
        }
      }

      if (navigator.vibrate) navigator.vibrate(100);
      setStatus({ success: true });
    } catch (err: unknown) {
      // Network error — queue for offline sync
      if (!(err instanceof ApiError)) {
        try {
          await pushAction({ type: "move", vehicle_id: id, payload, photos: [] });
          await refreshCount();
          if (navigator.vibrate) navigator.vibrate(100);
          setStatus({ success: true });
          return;
        } catch { /* fall through */ }
      }
      setStatus({ error: err instanceof Error ? err.message : "Move failed" });
    } finally {
      setStatus({ loading: false });
    }
  }

  if (success && vehicle && selectedBay) {
    return (
      <SuccessScreen
        title={`${vehicle.make} ${vehicle.model}`}
        subtitle={`Moved to ${selectedBay.code}`}
        onDone={() => router.push(`/vehicle/${id}`)}
      />
    );
  }

  if (vehicleLoading) {
    return (
      <AppShell>
        <VehicleCardSkeleton />
      </AppShell>
    );
  }

  if (!vehicle) {
    return (
      <AppShell>
        <p className="text-center text-white/50 py-12">Vehicle not found</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Move Vehicle"
          subtitle={`${vehicle.make} ${vehicle.model}`}
          backHref={`/vehicle/${id}`}
        />

        {/* Bay Selection */}
        <div>
          <h3 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            Select Destination Bay
          </h3>
          <BaySelector
            bays={bays}
            selectedBayId={selectedBay?.id || null}
            onSelect={setSelectedBay}
            loading={baysLoading}
          />
        </div>

        {/* Photo (optional) */}
        <div>
          <h3 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            Photo (optional)
          </h3>
          <CameraCapture
            onCapture={addPhoto}
            multiple
            label="Take photo"
          />
          {photos.length > 0 && (
            <div className="mt-3">
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <div key={photo.preview} className="relative aspect-square rounded-lg overflow-hidden">
                    <Image src={photo.preview} alt="" fill unoptimized sizes="33vw" className="object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      aria-label="Remove photo"
                      className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm resize-none transition-colors"
          />
        </div>

        {error && (
          <p className="text-danger text-sm text-center">{error}</p>
        )}

        {/* Confirm */}
        <div className="pb-4">
          <ActionButton
            onClick={handleMove}
            loading={loading}
            disabled={!selectedBay}
          >
            {selectedBay
              ? `Move to ${selectedBay.code}`
              : "Select a bay first"}
          </ActionButton>
        </div>
      </div>
    </AppShell>
  );
}
