import { useState, useCallback, useEffect, useRef } from "react";

interface CapturedPhoto {
  file: File;
  preview: string;
}

export function useCamera() {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const photosRef = useRef(photos);
  photosRef.current = photos;

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

  // Revoke all object URLs on unmount to prevent memory leaks.
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []);

  return { photos, addPhoto, removePhoto };
}
