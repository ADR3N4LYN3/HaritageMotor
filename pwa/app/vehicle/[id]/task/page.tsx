"use client";

import { useState, useReducer } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ActionButton } from "@/components/ui/ActionButton";
import { SuccessScreen } from "@/components/ui/SuccessScreen";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useVehicle } from "@/hooks/useVehicle";
import { api, ApiError } from "@/lib/api";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { pushAction } from "@/lib/offline-queue";
import type { Task } from "@/lib/types";
import useSWR from "swr";

const taskIcons: Record<string, string> = {
  battery_start: "🔋",
  tire_pressure: "🔧",
  wash: "🚿",
  fluid_check: "🔍",
  custom: "📋",
};

export default function TaskPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { vehicle, isLoading: vehicleLoading } = useVehicle(id);
  const { data: tasksData, isLoading: tasksLoading, error: tasksError, mutate } = useSWR<{ data: Task[] }>(
    id ? `/tasks?vehicle_id=${id}&status=pending` : null
  );
  const tasks = tasksData?.data || [];
  const { refreshCount } = useOfflineQueue();

  const [completing, setCompleting] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [{ loading, success, error }, setStatus] = useReducer(
    (s: { loading: boolean; success: { task: Task } | null; error: string | null }, a: Partial<{ loading: boolean; success: { task: Task } | null; error: string | null }>) => ({ ...s, ...a }),
    { loading: false, success: null as { task: Task } | null, error: null as string | null }
  );

  async function handleComplete(task: Task) {
    setStatus({ loading: true, error: null });

    const payload = { task_id: task.id, notes: notes || undefined };

    // Offline fallback — queue for later sync
    if (!navigator.onLine) {
      try {
        await pushAction({ type: "task", vehicle_id: id, payload, photos: [] });
        await refreshCount();
        if (navigator.vibrate) navigator.vibrate(100);
        setStatus({ success: { task } });
      } catch {
        setStatus({ error: "Failed to queue action offline" });
      } finally {
        setStatus({ loading: false });
      }
      return;
    }

    try {
      await api.post(`/tasks/${task.id}/complete`, {
        notes: notes || undefined,
      });
      if (navigator.vibrate) navigator.vibrate(100);
      setStatus({ success: { task } });
      mutate();
    } catch (err: unknown) {
      // Network error — queue for offline sync
      if (!(err instanceof ApiError)) {
        try {
          await pushAction({ type: "task", vehicle_id: id, payload, photos: [] });
          await refreshCount();
          if (navigator.vibrate) navigator.vibrate(100);
          setStatus({ success: { task } });
          return;
        } catch { /* fall through */ }
      }
      setStatus({ error: err instanceof Error ? err.message : "Failed to complete task" });
    } finally {
      setStatus({ loading: false });
    }
  }

  if (success && vehicle) {
    return (
      <SuccessScreen
        title="Task Completed"
        subtitle={`${success.task.title} — ${vehicle.make} ${vehicle.model}`}
        onDone={() => {
          setStatus({ success: null });
          setCompleting(null);
          setNotes("");
        }}
      />
    );
  }

  if (vehicleLoading) {
    return (
      <AppShell>
        <VehicleCardSkeleton />
      </AppShell>
    );
  }

  if (!vehicle) {
    return (
      <AppShell>
        <p className="text-center text-white/50 py-12">Vehicle not found</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Vehicle Info */}
        <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
          <h2 className="font-display text-xl font-light tracking-wide text-white">
            {vehicle.make} {vehicle.model}
          </h2>
          <p className="text-sm text-white/50 mt-0.5">
            {vehicle.color}{vehicle.year ? ` · ${vehicle.year}` : ""}
          </p>
        </div>

        {/* Task List */}
        <div>
          <h3 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            Pending Tasks
          </h3>
          {tasksLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : tasksError ? (
            <div className="text-center py-8 text-danger text-sm">
              Failed to load tasks
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/30 text-sm">No pending tasks</p>
              <ActionButton
                variant="secondary"
                onClick={() => router.push(`/vehicle/${id}`)}
                className="mt-4"
              >
                Back to Vehicle
              </ActionButton>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                const isExpanded = completing === task.id;

                return (
                  <div
                    key={task.id}
                    className="bg-white/[0.03] rounded-2xl border border-white/[0.06] overflow-hidden"
                  >
                    <button
                      onClick={() => setCompleting(isExpanded ? null : task.id)}
                      aria-expanded={isExpanded}
                      className="w-full text-left p-4 flex items-center gap-3 touch-target"
                    >
                      <span className="text-xl">
                        {taskIcons[task.task_type] || "📋"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm truncate">
                            {task.title}
                          </span>
                          {isOverdue && (
                            <span className="text-xs bg-danger/10 text-danger px-1.5 py-0.5 rounded-full font-medium">
                              Overdue
                            </span>
                          )}
                        </div>
                        {task.due_date && (
                          <p className="text-xs text-white/40 mt-0.5">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <svg
                        aria-hidden="true"
                        className={`w-5 h-5 text-white/30 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 space-y-3 border-t border-white/[0.06]">
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Notes (optional)"
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none transition-colors"
                        />
                        {error && (
                          <p className="text-danger text-xs">{error}</p>
                        )}
                        <ActionButton
                          onClick={() => handleComplete(task)}
                          loading={loading}
                        >
                          Mark as Done
                        </ActionButton>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
