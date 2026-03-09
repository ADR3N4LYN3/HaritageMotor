import { useState, useCallback } from "react";

interface CapturedPhoto {
  file: File;
  preview: string;
}

export function useCamera() {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);

  const addPhoto = useCallback((file: File, preview: string) => {
    setPhotos((prev) => [...prev, { file, preview }]);
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const clearPhotos = useCallback(() => {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
  }, [photos]);

  return { photos, addPhoto, removePhoto, clearPhotos };
}
