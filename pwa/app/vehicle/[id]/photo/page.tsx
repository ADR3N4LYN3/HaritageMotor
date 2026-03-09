"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { ActionButton } from "@/components/ui/ActionButton";
import { PhotoGrid } from "@/components/camera/PhotoGrid";
import { SuccessScreen } from "@/components/ui/SuccessScreen";
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

export default function PhotoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { vehicle } = useVehicle(id);
  const { photos, addPhoto, removePhoto } = useCamera();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (photos.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled(photos.map((photo) => {
        const formData = new FormData();
        formData.append("file", photo.file);
        formData.append("doc_type", "other");
        formData.append("notes", "Photo added");
        return api.upload(`/vehicles/${id}/documents`, formData);
      }));
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        throw new Error(`${failed.length} photo(s) failed to upload`);
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  if (success && vehicle) {
    return (
      <SuccessScreen
        title="Photos Uploaded"
        subtitle={`${photos.length} photo${photos.length > 1 ? "s" : ""} — ${vehicle.make} ${vehicle.model}`}
        onDone={() => router.push(`/vehicle/${id}`)}
      />
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#0e0d0b]/5">
          <h2 className="font-display text-xl font-semibold text-[#0e0d0b]">
            {vehicle ? `${vehicle.make} ${vehicle.model}` : "..."}
          </h2>
          <p className="text-sm text-[#0e0d0b]/50 mt-1">Add Photos</p>
        </div>

        <CameraCapture onCapture={addPhoto} multiple label="Take photo" />

        {photos.length > 0 && (
          <PhotoGrid photos={photos} onRemove={removePhoto} />
        )}

        {error && (
          <p className="text-[#ef4444] text-sm text-center">{error}</p>
        )}

        <ActionButton
          onClick={handleUpload}
          loading={loading}
          disabled={photos.length === 0}
        >
          Upload {photos.length} Photo{photos.length !== 1 ? "s" : ""}
        </ActionButton>
      </div>
    </AppShell>
  );
}
