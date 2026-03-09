"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";

interface QRScannerProps {
  onResult: (token: string) => void;
  onError?: (error: string) => void;
}

export function QRScanner({ onResult, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(true);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);

  useEffect(() => {
    if (!scanning) return;

    const reader = new BrowserQRCodeReader();
    readerRef.current = reader;

    const startScanning = async () => {
      try {
        const videoInputDevices = await BrowserQRCodeReader.listVideoInputDevices();
        // Prefer back camera
        const backCamera = videoInputDevices.find(
          (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear") || d.label.toLowerCase().includes("environment")
        );
        const deviceId = backCamera?.deviceId || videoInputDevices[0]?.deviceId;

        if (!deviceId) {
          onError?.("No camera found");
          return;
        }

        await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          (result, error) => {
            if (result) {
              setScanning(false);
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(100);
              }
              onResult(result.getText());
            }
          }
        );
      } catch {
        onError?.("Camera access denied");
      }
    };

    startScanning();

    const currentVideo = videoRef.current;
    return () => {
      if (readerRef.current) {
        // Stop all tracks
        if (currentVideo?.srcObject) {
          const stream = currentVideo.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
        }
      }
    };
  }, [scanning, onResult, onError]);

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />
      {/* Scan frame overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-64 h-64">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#b8955a]" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#b8955a]" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#b8955a]" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#b8955a]" />
          {/* Scan line animation */}
          <div className="absolute left-2 right-2 h-0.5 bg-[#b8955a]/60 animate-scan" />
        </div>
      </div>
      {/* Dim outside scan area */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" style={{
        maskImage: "radial-gradient(circle 140px at center, transparent 0%, transparent 100%, black 100%)",
        WebkitMaskImage: "radial-gradient(circle 140px at center, transparent 0%, transparent 100%, black 100%)",
      }} />
      {/* Instructions */}
      <div className="absolute bottom-24 left-0 right-0 text-center">
        <p className="text-[#faf9f7]/80 text-sm font-medium">
          Point camera at QR code
        </p>
      </div>
    </div>
  );
}
