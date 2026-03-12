"use client";

import { useState, useMemo, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { useAppStore } from "@/store/app.store";
import { api, ApiError } from "@/lib/api";
import type { Task, Vehicle, PaginatedResponse } from "@/lib/types";
import useSWR from "swr";

const taskIcons: Record<string, string> = {
  battery_start: "\uD83D\uDD0B",
  tire_pressure: "\uD83D\uDD27",
  wash: "\uD83D\uDEBF",
  fluid_check: "\uD83D\uDD0D",
  custom: "\uD83D\uDCCB",
};

const TASK_TYPES = ["battery_start", "tire_pressure", "wash", "fluid_check", "custom"];

const TASK_TYPE_LABELS: Record<string, string> = {
  battery_start: "Battery Start",
  tire_pressure: "Tire Pressure",
  wash: "Wash",
  fluid_check: "Fluid Check",
  custom: "Custom",
};

const STATUS_FILTERS = ["", "pending", "completed", "overdue"] as const;

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  overdue: "bg-danger/10 text-danger",
  cancelled: "bg-white/[0.06] text-white/50",
};

export default function TasksPage() {
  const user = useAppStore((s) => s.user);
  const canCreate =
    user?.role === "admin" || user?.role === "operator" || user?.role === "technician";

  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [showCreate, setShowCreate] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set("status", statusFilter);
  queryParams.set("page", String(page));
  queryParams.set("per_page", String(perPage));
  const queryString = `?${queryParams.toString()}`;

  const { data, isLoading, error, mutate } = useSWR<PaginatedResponse<Task>>(
    `/tasks${queryString}`,
    { refreshInterval: 30000 }
  );
  const tasks = useMemo(() => data?.data || [], [data]);
  const totalCount = data?.total_count || 0;
  const totalPages = Math.ceil(totalCount / perPage);

  // Vehicle lookup for displaying names
  const { data: vehiclesData } = useSWR<PaginatedResponse<Vehicle>>(
    "/vehicles?per_page=100",
    { refreshInterval: 60000 }
  );
  const vehicleMap = useMemo(() => {
    const map = new Map<string, string>();
    if (vehiclesData?.data) {
      for (const v of vehiclesData.data) {
        map.set(v.id, `${v.make} ${v.model}`);
      }
    }
    return map;
  }, [vehiclesData]);

  const handleComplete = useCallback(
    async (taskId: string) => {
      setCompleteLoading(true);
      setCompleteError(null);
      try {
        await api.post(`/tasks/${taskId}/complete`, {});
        if (navigator.vibrate) navigator.vibrate(100);
        setCompleting(null);
        mutate();
      } catch (err: unknown) {
        setCompleteError(err instanceof Error ? err.message : "Failed to complete task");
      } finally {
        setCompleteLoading(false);
      }
    },
    [mutate]
  );

  const handleFilterChange = useCallback((status: string) => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Tasks"
          action={
            canCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-10 h-10 rounded-full border border-gold/40 bg-transparent flex items-center justify-center text-gold text-xl font-light hover:bg-gold hover:text-black transition-all duration-500 active:scale-95"
                style={{ transitionTimingFunction: "var(--ease-lux)" }}
                aria-label="Create task"
              >
                +
              </button>
            ) : undefined
          }
        />

        {/* Status filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => handleFilterChange(s)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                statusFilter === s
                  ? "bg-gold/15 text-gold border-gold/30"
                  : "bg-white/[0.04] text-white/50 border-white/[0.06]"
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>

        {/* Task list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-danger text-sm font-light">
            Failed to load tasks
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm font-light">
            No tasks found
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const isOverdue =
                task.status === "pending" &&
                task.due_date &&
                new Date(task.due_date) < new Date();
              const isExpanded = completing === task.id;
              const vehicleName = vehicleMap.get(task.vehicle_id) || "Unknown vehicle";

              return (
                <div
                  key={task.id}
                  className="bg-white/[0.03] rounded-2xl border border-white/[0.06] overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setCompleting(isExpanded ? null : task.id)
                    }
                    aria-expanded={isExpanded}
                    className="w-full text-left p-4 flex items-center gap-3 touch-target"
                  >
                    <span className="text-xl">
                      {taskIcons[task.task_type] || "\uD83D\uDCCB"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white text-sm truncate">
                        {task.title}
                      </h3>
                      <p className="text-xs text-white/40 mt-0.5 truncate">
                        {vehicleName}
                      </p>
                      {task.due_date && (
                        <p className="text-xs text-white/30 mt-0.5">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          isOverdue
                            ? statusColors.overdue
                            : statusColors[task.status] || statusColors.pending
                        }`}
                      >
                        {isOverdue ? "overdue" : task.status}
                      </span>
                    </div>
                  </button>

                  {isExpanded && task.status === "pending" && (
                    <div className="px-4 pb-4 pt-0 space-y-3 border-t border-white/[0.06]">
                      {task.description && (
                        <p className="text-sm text-white/50 pt-3">
                          {task.description}
                        </p>
                      )}
                      {completeError && (
                        <p className="text-danger text-xs">{completeError}</p>
                      )}
                      {canCreate && (
                        <ActionButton
                          onClick={() => handleComplete(task.id)}
                          loading={completeLoading}
                        >
                          Mark as Done
                        </ActionButton>
                      )}
                    </div>
                  )}

                  {isExpanded && task.status !== "pending" && task.description && (
                    <div className="px-4 pb-4 pt-0 border-t border-white/[0.06]">
                      <p className="text-sm text-white/50 pt-3">
                        {task.description}
                      </p>
                      {task.completed_at && (
                        <p className="text-xs text-white/30 mt-2">
                          Completed:{" "}
                          {new Date(task.completed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-white/[0.08] bg-white/[0.04] text-white/50 disabled:opacity-30 transition-colors hover:text-gold hover:border-gold/30"
            >
              Previous
            </button>
            <span className="text-xs text-white/40">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm border border-white/[0.08] bg-white/[0.04] text-white/50 disabled:opacity-30 transition-colors hover:text-gold hover:border-gold/30"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreate && (
        <CreateTaskModal
          vehicleMap={vehicleMap}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            mutate();
          }}
        />
      )}
    </AppShell>
  );
}

/* ─── Create Task Modal ─── */

interface CreateTaskModalProps {
  vehicleMap: Map<string, string>;
  onClose: () => void;
  onCreated: () => void;
}

function CreateTaskModal({ vehicleMap, onClose, onCreated }: CreateTaskModalProps) {
  const [vehicleId, setVehicleId] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [taskType, setTaskType] = useState("custom");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredVehicles = useMemo(() => {
    const entries = Array.from(vehicleMap.entries());
    if (!vehicleSearch.trim()) return entries;
    const q = vehicleSearch.toLowerCase();
    return entries.filter(([, name]) => name.toLowerCase().includes(q));
  }, [vehicleMap, vehicleSearch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleId || !title.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await api.post("/tasks", {
        vehicle_id: vehicleId,
        task_type: taskType,
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueDate || undefined,
      });
      onCreated();
    } catch (err: unknown) {
      setError(
        err instanceof ApiError ? err.message : "Failed to create task"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg bg-[#111] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-light tracking-wide text-white">
            New Task
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Vehicle selector */}
        <div className="relative">
          <label className="text-sm font-semibold text-white/30 uppercase tracking-wider block mb-1.5">
            Vehicle
          </label>
          <input
            type="text"
            value={vehicleSearch}
            onChange={(e) => {
              setVehicleSearch(e.target.value);
              setShowDropdown(true);
              if (!e.target.value) setVehicleId("");
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search vehicle..."
            className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
          />
          {showDropdown && filteredVehicles.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-[#1a1a1a] border border-white/[0.1] rounded-lg max-h-40 overflow-y-auto">
              {filteredVehicles.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setVehicleId(id);
                    setVehicleSearch(name);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors ${
                    vehicleId === id ? "text-gold" : "text-white/70"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Task type */}
        <div>
          <label className="text-sm font-semibold text-white/30 uppercase tracking-wider block mb-1.5">
            Task Type
          </label>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
          >
            {TASK_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#1a1a1a]">
                {taskIcons[t]} {TASK_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="text-sm font-semibold text-white/30 uppercase tracking-wider block mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title..."
            required
            className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-semibold text-white/30 uppercase tracking-wider block mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none transition-colors"
          />
        </div>

        {/* Due date */}
        <div>
          <label className="text-sm font-semibold text-white/30 uppercase tracking-wider block mb-1.5">
            Due Date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
          />
        </div>

        {error && <p className="text-danger text-xs">{error}</p>}

        <ActionButton type="submit" loading={loading} disabled={!vehicleId || !title.trim()}>
          Create Task
        </ActionButton>
      </form>
    </div>
  );
}
