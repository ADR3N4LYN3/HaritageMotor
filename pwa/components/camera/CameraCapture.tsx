"use client";

import { useRef, useState, useCallback } from "react";
import { ActionButton } from "../ui/ActionButton";

interface CameraCaptureProps {
  onCapture: (file: File, preview: string) => void;
  multiple?: boolean;
  label?: string;
}

export function CameraCapture({ onCapture, multiple = false, label = "Take photo" }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }
    } catch {
      // Fallback: try without specific constraints
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsStreaming(true);
        }
      } catch {
        alert("Camera access denied");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = Math.min(video.videoWidth, 1920);
    canvas.height = Math.min(video.videoHeight, 1080);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const timestamp = Date.now();
        const file = new File([blob], `photo_${timestamp}.jpg`, { type: "image/jpeg" });
        const previewUrl = URL.createObjectURL(blob);
        setPreview(previewUrl);
        onCapture(file, previewUrl);

        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(50);
        }

        if (!multiple) {
          stopCamera();
        }
      },
      "image/jpeg",
      0.85
    );
  }, [onCapture, multiple, stopCamera]);

  const retake = useCallback(() => {
    setPreview(null);
    if (!isStreaming) {
      startCamera();
    }
  }, [isStreaming, startCamera]);

  if (preview && !multiple) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Captured" className="w-full aspect-video object-cover" />
          <button
            onClick={retake}
            className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />

      {isStreaming ? (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-black">
            <video ref={videoRef} className="w-full aspect-video object-cover" playsInline muted />
          </div>
          <div className="flex gap-2">
            <ActionButton onClick={capture} variant="primary">
              Capture
            </ActionButton>
            <ActionButton onClick={stopCamera} variant="secondary" fullWidth={false} className="px-4">
              Close
            </ActionButton>
          </div>
        </div>
      ) : (
        <ActionButton onClick={startCamera} variant="secondary">
          {label}
        </ActionButton>
      )}
    </div>
  );
}
