"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ActionButton } from "@/components/ui/ActionButton";
import { SuccessScreen } from "@/components/ui/SuccessScreen";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useVehicle } from "@/hooks/useVehicle";
import { api } from "@/lib/api";
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

  const [completing, setCompleting] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ task: Task } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete(task: Task) {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/tasks/${task.id}/complete`, {
        notes: notes || undefined,
      });
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(100);
      }
      setSuccess({ task });
      mutate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to complete task");
    } finally {
      setLoading(false);
    }
  }

  if (success && vehicle) {
    return (
      <SuccessScreen
        title="Task Completed"
        subtitle={`${success.task.title} — ${vehicle.make} ${vehicle.model}`}
        onDone={() => {
          setSuccess(null);
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
        <p className="text-center text-[#0e0d0b]/50 py-12">Vehicle not found</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Vehicle Info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#0e0d0b]/5">
          <h2 className="font-display text-xl font-semibold text-[#0e0d0b]">
            {vehicle.make} {vehicle.model}
          </h2>
          <p className="text-sm text-[#0e0d0b]/50 mt-0.5">
            {vehicle.color}{vehicle.year ? ` · ${vehicle.year}` : ""}
          </p>
        </div>

        {/* Task List */}
        <div>
          <h3 className="text-sm font-semibold text-[#0e0d0b]/40 uppercase tracking-wider mb-3">
            Pending Tasks
          </h3>
          {tasksLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : tasksError ? (
            <div className="text-center py-8 text-[#ef4444] text-sm">
              Failed to load tasks
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#0e0d0b]/40 text-sm">No pending tasks</p>
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
                    className="bg-white rounded-2xl shadow-sm border border-[#0e0d0b]/5 overflow-hidden"
                  >
                    <button
                      onClick={() => setCompleting(isExpanded ? null : task.id)}
                      className="w-full text-left p-4 flex items-center gap-3 touch-target"
                    >
                      <span className="text-xl">
                        {taskIcons[task.task_type] || "📋"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#0e0d0b] text-sm truncate">
                            {task.title}
                          </span>
                          {isOverdue && (
                            <span className="text-xs bg-[#ef4444]/10 text-[#ef4444] px-1.5 py-0.5 rounded-full font-medium">
                              Overdue
                            </span>
                          )}
                        </div>
                        {task.due_date && (
                          <p className="text-xs text-[#0e0d0b]/40 mt-0.5">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <svg
                        className={`w-5 h-5 text-[#0e0d0b]/30 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 space-y-3 border-t border-[#0e0d0b]/5">
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Notes (optional)"
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-[#0e0d0b]/10 text-sm placeholder:text-[#0e0d0b]/30 focus:outline-none focus:ring-2 focus:ring-[#b8955a]/50 resize-none"
                        />
                        {error && (
                          <p className="text-[#ef4444] text-xs">{error}</p>
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
