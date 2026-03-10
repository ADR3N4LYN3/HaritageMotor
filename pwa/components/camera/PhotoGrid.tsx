"use client";

import Image from "next/image";

interface PhotoGridProps {
  photos: Array<{ file: File; preview: string }>;
  required?: number;
  onRemove?: (index: number) => void;
}

export function PhotoGrid({ photos, required, onRemove }: PhotoGridProps) {
  return (
    <div className="space-y-2">
      {required !== undefined && (
        <div className={`text-sm font-medium ${photos.length >= required ? "text-success" : "text-warning"}`}>
          {photos.length} / {required} photos {photos.length >= required ? "✓" : ""}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, index) => (
          <div key={photo.preview} className="relative aspect-square rounded-lg overflow-hidden">
            <Image src={photo.preview} alt={`Photo ${index + 1}`} fill unoptimized sizes="33vw" className="object-cover" />
            {onRemove && (
              <button
                onClick={() => onRemove(index)}
                aria-label="Supprimer la photo"
                className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
