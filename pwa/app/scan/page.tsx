"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import { api, ApiError } from "@/lib/api";
import type { ScanResult } from "@/lib/types";

const QRScanner = dynamic(
  () =>
    import("@/components/scanner/QRScanner").then((mod) => ({
      default: mod.QRScanner,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-64 bg-neutral-900 animate-pulse rounded-xl" />
    ),
  }
);

export default function ScanPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [showManual, setShowManual] = useState(false);

  async function resolveToken(token: string) {
    setResolving(true);
    setError(null);
    try {
      const result = await api.get<ScanResult>(`/scan/${encodeURIComponent(token)}`);
      if (result.entity_type === "vehicle") {
        router.push(`/vehicle/${result.entity_id}`);
      } else if (result.entity_type === "bay") {
        router.push(`/bay/${result.entity_id}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 404 ? "QR code not recognized" : err.message);
      } else {
        setError("Network error — check connection");
      }
      setResolving(false);
    }
  }

  if (resolving) {
    return (
      <div className="fixed inset-0 bg-[#0e0d0b] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#b8955a]/30 border-t-[#b8955a] rounded-full animate-spin" />
        <p className="text-[#faf9f7]/60 text-sm">Resolving...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {!showManual ? (
        <>
          <QRScanner
            onResult={resolveToken}
            onError={(err) => setError(err)}
          />
          {error && (
            <div className="absolute top-20 left-4 right-4 bg-[#ef4444]/90 text-white text-sm p-3 rounded-xl text-center">
              {error}
            </div>
          )}
          <div className="absolute bottom-8 left-4 right-4 space-y-3">
            <button
              onClick={() => setShowManual(true)}
              className="w-full py-3 text-[#faf9f7]/60 text-sm underline"
            >
              Enter code manually
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full px-6 gap-4">
          <h2 className="text-[#faf9f7] text-xl font-display font-semibold">
            Enter Vehicle Code
          </h2>
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Enter QR token..."
            className="w-full px-4 py-3 rounded-xl bg-white/10 text-[#faf9f7] placeholder:text-[#faf9f7]/30 border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#b8955a]/50"
            autoFocus
          />
          {error && (
            <p className="text-[#ef4444] text-sm">{error}</p>
          )}
          <div className="w-full flex gap-2">
            <button
              onClick={() => { setShowManual(false); setError(null); }}
              className="flex-1 py-3 rounded-xl border border-white/20 text-[#faf9f7]/60 text-sm"
            >
              Back to Scanner
            </button>
            <button
              onClick={() => manualCode && resolveToken(manualCode)}
              className="flex-1 py-3 rounded-xl bg-[#b8955a] text-[#faf9f7] font-medium text-sm"
              disabled={!manualCode}
            >
              Search
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
