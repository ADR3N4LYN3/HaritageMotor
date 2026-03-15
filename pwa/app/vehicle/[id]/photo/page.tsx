"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { PhotoGrid } from "@/components/camera/PhotoGrid";
import { SuccessScreen } from "@/components/ui/SuccessScreen";
import { useVehicle } from "@/hooks/useVehicle";
import { useCamera } from "@/hooks/useCamera";
import { api } from "@/lib/api";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useI18n } from "@/lib/i18n";
import { vehiclePhotoI18n } from "@/lib/translations";

const CameraCapture = dynamic(
  () =>
    import("@/components/camera/CameraCapture").then((mod) => ({
      default: mod.CameraCapture,
    })),
  { ssr: false, loading: () => <div className="h-12 bg-white/[0.04] animate-pulse rounded-xl" /> }
);

export default function PhotoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { t } = useI18n(vehiclePhotoI18n);
  const { vehicle } = useVehicle(id);
  const { photos, addPhoto, removePhoto } = useCamera();
  useOfflineQueue(); // Activate sync listeners for pending actions
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

  if (success) {
    return (
      <SuccessScreen
        title={t.uploaded}
        subtitle={vehicle ? `${photos.length} ${photos.length > 1 ? t.photos : t.photo} — ${vehicle.make} ${vehicle.model}` : `${photos.length} ${photos.length > 1 ? t.photos : t.photo}`}
        onDone={() => router.push(`/vehicle/${id}`)}
      />
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t.title}
          subtitle={vehicle ? `${vehicle.make} ${vehicle.model}` : undefined}
          backHref={`/vehicle/${id}`}
        />

        <CameraCapture onCapture={addPhoto} multiple label={t.takePhoto} />

        {photos.length > 0 && (
          <PhotoGrid photos={photos} onRemove={removePhoto} />
        )}

        {error && (
          <p className="text-danger text-sm text-center">{error}</p>
        )}

        <ActionButton
          onClick={handleUpload}
          loading={loading}
          disabled={photos.length === 0}
        >
          {t.upload} {photos.length} {photos.length !== 1 ? t.photos : t.photo}
        </ActionButton>
      </div>
    </AppShell>
  );
}
