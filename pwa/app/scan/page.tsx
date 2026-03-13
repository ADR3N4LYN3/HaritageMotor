"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { api, ApiError } from "@/lib/api";
import type { ScanResult } from "@/lib/types";
import { VehiclesSheet } from "@/components/scan/VehiclesSheet";
import { BaysSheet } from "@/components/scan/BaysSheet";
import { TasksSheet } from "@/components/scan/TasksSheet";
import { ManualSheet } from "@/components/scan/ManualSheet";

const QRScanner = dynamic(
  () =>
    import("@/components/scanner/QRScanner").then((mod) => ({
      default: mod.QRScanner,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-64 bg-white/[0.03] animate-pulse rounded-xl" />
    ),
  }
);

type SheetType = "vehicles" | "bays" | "tasks" | "manual" | null;

export default function ScanPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [sheet, setSheet] = useState<SheetType>(null);
  const [search, setSearch] = useState("");

  async function resolveToken(token: string) {
    setResolving(true);
    setError(null);
    try {
      const result = await api.get<ScanResult>(`/scan/${encodeURIComponent(token)}`);
      if (result.entity_type === "vehicle") {
        router.push(`/vehicle/${result.entity_id}`);
      } else if (result.entity_type === "bay") {
        router.push(`/bay/${result.entity_id}`);
      } else {
        setError("Unknown QR code type");
        setResolving(false);
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

  const openSheet = useCallback((type: SheetType) => {
    setSheet(type);
    setSearch("");
    setError(null);
  }, []);

  if (resolving) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-gold/30 border-t-gold rounded-full animate-spin" />
        <p className="text-white/60 text-sm">Resolving...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Scanner background — always visible */}
      <QRScanner
        onResult={resolveToken}
        onError={(err) => setError(err)}
      />

      {/* Error toast */}
      {error && !sheet && (
        <div className="absolute top-20 left-4 right-4 z-50 bg-danger/90 text-white text-sm p-3 rounded-xl text-center">
          {error}
        </div>
      )}

      {/* Bottom action bar */}
      {!sheet && (
        <div className="absolute bottom-0 left-0 right-0 z-50 safe-bottom">
          <div className="bg-gradient-to-t from-black via-black/90 to-transparent pt-12 pb-6 px-4">
            <div className="grid grid-cols-4 gap-2">
              <ActionPill icon="car" label="Vehicles" onClick={() => openSheet("vehicles")} />
              <ActionPill icon="bay" label="Bays" onClick={() => openSheet("bays")} />
              <ActionPill icon="task" label="Tasks" onClick={() => openSheet("tasks")} />
              <ActionPill icon="keyboard" label="Manual" onClick={() => openSheet("manual")} />
            </div>
          </div>
        </div>
      )}

      {/* Bottom sheet overlay */}
      {sheet && (
        <div className="absolute inset-0 z-50 flex flex-col">
          {/* Backdrop — tap to close */}
          <button
            onClick={() => setSheet(null)}
            className="flex-shrink-0 h-[25vh] bg-black/40 backdrop-blur-sm"
            aria-label="Close panel"
          />
          {/* Sheet */}
          <div className="flex-1 bg-black rounded-t-3xl border-t border-gold/15 flex flex-col overflow-hidden animate-slide-up">
            {/* Handle + close */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="w-8" />
              <div className="w-10 h-1 rounded-full bg-white/15" />
              <button
                onClick={() => setSheet(null)}
                className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Sheet content */}
            <div className="flex-1 overflow-y-auto px-4 pb-8">
              {sheet === "vehicles" && <VehiclesSheet search={search} setSearch={setSearch} onNavigate={(id) => router.push(`/vehicle/${id}`)} />}
              {sheet === "bays" && <BaysSheet search={search} setSearch={setSearch} onNavigate={(id) => router.push(`/bay/${id}`)} />}
              {sheet === "tasks" && <TasksSheet onNavigate={(id) => router.push(`/vehicle/${id}`)} />}
              {sheet === "manual" && (
                <ManualSheet
                  code={manualCode}
                  setCode={setManualCode}
                  error={error}
                  onSubmit={() => manualCode && resolveToken(manualCode)}
                  onBack={() => setSheet(null)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}

/* ─── Action Pill ─── */
function ActionPill({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/[0.08] active:scale-95 transition-transform"
    >
      <PillIcon type={icon} />
      <span className="text-[10px] font-medium text-white/60">{label}</span>
    </button>
  );
}

function PillIcon({ type }: { type: string }) {
  const cls = "w-5 h-5 text-gold/80";
  switch (type) {
    case "car":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.6A2 2 0 0 0 13.7 5H10.3a2 2 0 0 0-1.6.8L6 9l-2.5 1.1C2.7 10.8 2 11.6 2 12.5V16c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" />
        </svg>
      );
    case "bay":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      );
    case "task":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      );
    case "keyboard":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
        </svg>
      );
    default:
      return null;
  }
}
