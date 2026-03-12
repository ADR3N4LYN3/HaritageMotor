"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { api, ApiError } from "@/lib/api";
import type { ScanResult, Vehicle, Bay, Task } from "@/lib/types";
import useSWR from "swr";

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

/* ─── Vehicles Sheet ─── */
function VehiclesSheet({ search, setSearch, onNavigate }: { search: string; setSearch: (s: string) => void; onNavigate: (id: string) => void }) {
  const query = search ? `?search=${encodeURIComponent(search)}&per_page=20` : "?per_page=20";
  const { data, isLoading } = useSWR<{ data: Vehicle[]; total_count: number }>(`/vehicles${query}`, { refreshInterval: 30000 });
  const vehicles = data?.data || [];

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-light tracking-wide text-white">Vehicles</h2>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search make, model, owner..."
        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
      />
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <div key={n} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : vehicles.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-6">No vehicles found</p>
      ) : (
        <div className="space-y-2">
          {vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => onNavigate(v.id)}
              className="w-full text-left bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{v.make} {v.model}</p>
                  <p className="text-xs text-white/40 mt-0.5">{v.owner_name}{v.year ? ` · ${v.year}` : ""}</p>
                </div>
                <StatusBadge status={v.status} />
              </div>
            </button>
          ))}
          {data && data.total_count > 20 && (
            <p className="text-center text-[10px] text-white/20 uppercase tracking-widest pt-2">
              {data.total_count} total — showing first 20
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Bays Sheet ─── */
function BaysSheet({ search, setSearch, onNavigate }: { search: string; setSearch: (s: string) => void; onNavigate: (id: string) => void }) {
  const { data, isLoading } = useSWR<{ data: Bay[]; total_count: number }>("/bays", { refreshInterval: 30000 });
  const allBays = useMemo(() => data?.data || [], [data]);
  const bays = useMemo(() => {
    if (!search) return allBays;
    const q = search.toLowerCase();
    return allBays.filter((b) => b.code.toLowerCase().includes(q) || b.zone?.toLowerCase().includes(q));
  }, [allBays, search]);

  const stats = useMemo(() => ({
    free: allBays.filter((b) => b.status === "free").length,
    occupied: allBays.filter((b) => b.status === "occupied").length,
    total: allBays.length,
  }), [allBays]);

  const bayStatusColors: Record<string, string> = {
    free: "bg-success/10 text-success",
    occupied: "bg-warning/10 text-warning",
    reserved: "bg-[#3b82f6]/10 text-[#3b82f6]",
    maintenance: "bg-danger/10 text-danger",
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-light tracking-wide text-white">Bays</h2>

      {/* Mini stats */}
      {!isLoading && (
        <div className="flex gap-2">
          <div className="bg-white/[0.03] rounded-lg px-3 py-1.5 border border-white/[0.06] text-center flex-1">
            <p className="text-sm font-light text-success">{stats.free}</p>
            <p className="text-[9px] text-white/30">Free</p>
          </div>
          <div className="bg-white/[0.03] rounded-lg px-3 py-1.5 border border-white/[0.06] text-center flex-1">
            <p className="text-sm font-light text-warning">{stats.occupied}</p>
            <p className="text-[9px] text-white/30">Occupied</p>
          </div>
          <div className="bg-white/[0.03] rounded-lg px-3 py-1.5 border border-white/[0.06] text-center flex-1">
            <p className="text-sm font-light text-white">{stats.total}</p>
            <p className="text-[9px] text-white/30">Total</p>
          </div>
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search bay code or zone..."
        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
      />
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <div key={n} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : bays.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-6">No bays found</p>
      ) : (
        <div className="space-y-2">
          {bays.map((bay) => (
            <button
              key={bay.id}
              onClick={() => onNavigate(bay.id)}
              className="w-full text-left bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{bay.code}</p>
                  {bay.zone && <p className="text-xs text-white/40 mt-0.5">{bay.zone}</p>}
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${bayStatusColors[bay.status] || "bg-white/[0.06] text-white/40"}`}>
                  {bay.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Tasks Sheet ─── */
function TasksSheet({ onNavigate }: { onNavigate: (vehicleId: string) => void }) {
  const { data, isLoading } = useSWR<{ data: Task[]; total_count: number }>("/tasks?status=pending&per_page=20", { refreshInterval: 30000 });
  const tasks = data?.data || [];

  const taskIcons: Record<string, string> = {
    battery_start: "\uD83D\uDD0B",
    tire_pressure: "\uD83D\uDD27",
    wash: "\uD83D\uDEBF",
    fluid_check: "\uD83D\uDD0D",
    custom: "\uD83D\uDCCB",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-light tracking-wide text-white">Pending Tasks</h2>
        {!isLoading && (
          <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">
            {data?.total_count ?? 0}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <div key={n} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-6">No pending tasks</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const isOverdue = task.due_date && new Date(task.due_date) < new Date();
            return (
              <button
                key={task.id}
                onClick={() => onNavigate(task.vehicle_id)}
                className="w-full text-left bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{taskIcons[task.task_type] || "\uD83D\uDCCB"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{task.title}</p>
                    {task.due_date && (
                      <p className={`text-xs mt-0.5 ${isOverdue ? "text-danger" : "text-white/40"}`}>
                        {isOverdue ? "Overdue" : "Due"}: {new Date(task.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {isOverdue && (
                    <span className="text-[10px] bg-danger/10 text-danger px-1.5 py-0.5 rounded-full font-medium">!</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Manual Entry Sheet ─── */
function ManualSheet({ code, setCode, error, onSubmit, onBack }: {
  code: string;
  setCode: (s: string) => void;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4 pt-4">
      <h2 className="font-display text-xl font-light tracking-wide text-white text-center">
        Enter QR Code
      </h2>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter QR token..."
        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] text-white placeholder:text-white/25 border border-white/[0.08] focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
      />
      {error && <p className="text-danger text-sm text-center">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-white/[0.08] text-white/50 text-sm font-medium active:scale-[0.98] transition-transform"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          className="flex-1 py-3 rounded-xl bg-gold text-white font-medium text-sm active:scale-[0.98] transition-transform"
          disabled={!code}
        >
          Search
        </button>
      </div>
    </div>
  );
}

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    stored: "bg-success/10 text-success",
    out: "bg-white/[0.06] text-white/40",
    transit: "bg-warning/10 text-warning",
    maintenance: "bg-danger/10 text-danger",
    sold: "bg-white/[0.04] text-white/25",
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colors[status] || colors.stored}`}>
      {status}
    </span>
  );
}
