"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ActionButton } from "@/components/ui/ActionButton";
import { BaySelector } from "@/components/ui/BaySelector";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { SuccessScreen } from "@/components/ui/SuccessScreen";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useVehicle } from "@/hooks/useVehicle";
import { useBays } from "@/hooks/useBay";
import { useCamera } from "@/hooks/useCamera";
import { api } from "@/lib/api";
import type { Bay } from "@/lib/types";

export default function MoveVehiclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { vehicle, isLoading: vehicleLoading } = useVehicle(id);
  const { bays, isLoading: baysLoading } = useBays();
  const { photos, addPhoto, removePhoto } = useCamera();

  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMove() {
    if (!selectedBay) return;
    setLoading(true);
    setError(null);
    try {
      await api.post(`/vehicles/${id}/move`, {
        to_bay_id: selectedBay.id,
        notes: notes || undefined,
      });

      // Upload photos if any
      for (const photo of photos) {
        const formData = new FormData();
        formData.append("file", photo.file);
        formData.append("doc_type", "other");
        formData.append("notes", "Move photo");
        await api.upload(`/vehicles/${id}/documents`, formData);
      }

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(100);
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Move failed");
    } finally {
      setLoading(false);
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
        <p className="text-center text-[#0e0d0b]/50 py-12">Vehicle not found</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Vehicle Info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#0e0d0b]/5">
          <h2 className="font-display text-xl font-semibold text-[#0e0d0b]">
            {vehicle.make} {vehicle.model}
          </h2>
          <p className="text-sm text-[#0e0d0b]/50 mt-0.5">
            {vehicle.color}
            {vehicle.year ? ` · ${vehicle.year}` : ""}
          </p>
        </div>

        {/* Bay Selection */}
        <div>
          <h3 className="text-sm font-semibold text-[#0e0d0b]/40 uppercase tracking-wider mb-3">
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
          <h3 className="text-sm font-semibold text-[#0e0d0b]/40 uppercase tracking-wider mb-3">
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
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
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
            className="w-full px-4 py-3 rounded-xl border border-[#0e0d0b]/10 bg-white text-[#0e0d0b] placeholder:text-[#0e0d0b]/30 focus:outline-none focus:ring-2 focus:ring-[#b8955a]/50 text-sm resize-none"
          />
        </div>

        {error && (
          <p className="text-[#ef4444] text-sm text-center">{error}</p>
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
