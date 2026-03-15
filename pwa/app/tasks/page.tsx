"use client";

import { useState, useMemo, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import type { TaskToEdit } from "@/components/tasks/CreateTaskModal";
import { useAppStore } from "@/store/app.store";
import { useI18n } from "@/lib/i18n";
import { tasksI18n } from "@/lib/translations";
import { api } from "@/lib/api";
import type { Task, Vehicle, PaginatedResponse } from "@/lib/types";
import useSWR from "swr";
import { TaskIcon } from "@/lib/task-constants";

const STATUS_FILTERS = ["", "pending", "completed", "overdue"] as const;

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  overdue: "bg-danger/10 text-danger",
  cancelled: "bg-white/[0.06] text-white/50",
};

export default function TasksPage() {
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const canCreate =
    isAdmin || user?.role === "operator" || user?.role === "technician";
  const { t } = useI18n(tasksI18n);

  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskToEdit | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const statusLabels: Record<string, string> = {
    "": t.all, pending: t.pending, completed: t.completed, overdue: t.overdue,
  };

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

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      if (deleteConfirm !== taskId) {
        setDeleteConfirm(taskId);
        return;
      }
      setDeleteLoading(true);
      try {
        await api.delete(`/tasks/${taskId}`);
        mutate();
        setDeleteConfirm(null);
        setCompleting(null);
      } catch (err: unknown) {
        setCompleteError(err instanceof Error ? err.message : "Failed to delete task");
      } finally {
        setDeleteLoading(false);
      }
    },
    [deleteConfirm, mutate]
  );

  const handleEditTask = useCallback(
    (task: Task) => {
      setEditingTask({
        id: task.id,
        vehicle_id: task.vehicle_id,
        task_type: task.task_type,
        title: task.title,
        description: task.description,
        due_date: task.due_date,
      });
    },
    []
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title={t.title}
          action={
            canCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-10 h-10 rounded-full border border-gold/40 bg-transparent flex items-center justify-center text-gold text-xl font-light hover:bg-gold hover:text-black transition-all duration-500 active:scale-95"
                style={{ transitionTimingFunction: "var(--ease-lux)" }}
                aria-label={t.createTask}
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
              {statusLabels[s] || s}
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
            {t.failedLoad}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm font-light">
            {t.noTasks}
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const isOverdue =
                task.status === "pending" &&
                task.due_date &&
                new Date(task.due_date) < new Date();
              const isExpanded = completing === task.id;
              const vehicleName = vehicleMap.get(task.vehicle_id) || t.unknownVehicle;

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
                    <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0 text-gold/70">
                      <TaskIcon type={task.task_type} className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white text-sm truncate">
                        {task.title}
                      </h3>
                      <p className="text-xs text-white/40 mt-0.5 truncate">
                        {vehicleName}
                      </p>
                      {task.due_date && (
                        <p className="text-xs text-white/30 mt-0.5">
                          {t.due} {new Date(task.due_date).toLocaleDateString()}
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
                        {isOverdue ? t.overdue : statusLabels[task.status] || task.status}
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
                        <div className="flex gap-2">
                          <ActionButton
                            onClick={() => handleComplete(task.id)}
                            loading={completeLoading}
                          >
                            {t.markDone}
                          </ActionButton>
                        </div>
                      )}
                      <div className="flex gap-2">
                        {canCreate && (
                          <button
                            onClick={() => handleEditTask(task)}
                            className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/50 text-xs hover:text-gold hover:border-gold/30 transition-colors"
                          >
                            {t.edit}
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            disabled={deleteLoading}
                            className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                              deleteConfirm === task.id
                                ? "border-danger/40 bg-danger/10 text-danger"
                                : "border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-danger hover:border-danger/30"
                            }`}
                          >
                            {deleteConfirm === task.id ? t.confirmDelete : t.delete}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isExpanded && task.status !== "pending" && (
                    <div className="px-4 pb-4 pt-0 border-t border-white/[0.06] space-y-3">
                      {task.description && (
                        <p className="text-sm text-white/50 pt-3">
                          {task.description}
                        </p>
                      )}
                      {task.completed_at && (
                        <p className="text-xs text-white/30 mt-2">
                          {t.completedAt}{" "}
                          {new Date(task.completed_at).toLocaleDateString()}
                        </p>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          disabled={deleteLoading}
                          className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                            deleteConfirm === task.id
                              ? "border-danger/40 bg-danger/10 text-danger"
                              : "border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-danger hover:border-danger/30"
                          }`}
                        >
                          {deleteConfirm === task.id ? t.confirmDelete : t.delete}
                        </button>
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
              {t.previous}
            </button>
            <span className="text-xs text-white/40">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm border border-white/[0.08] bg-white/[0.04] text-white/50 disabled:opacity-30 transition-colors hover:text-gold hover:border-gold/30"
            >
              {t.next}
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Task Modal */}
      {(showCreate || editingTask) && (
        <CreateTaskModal
          vehicleMap={vehicleMap}
          editTask={editingTask || undefined}
          onClose={() => {
            setShowCreate(false);
            setEditingTask(null);
          }}
          onCreated={() => {
            setShowCreate(false);
            setEditingTask(null);
            mutate();
          }}
        />
      )}
    </AppShell>
  );
}
