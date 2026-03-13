"use client";

import useSWR from "swr";
import type { Task } from "@/lib/types";

const taskIcons: Record<string, string> = {
  battery_start: "\uD83D\uDD0B",
  tire_pressure: "\uD83D\uDD27",
  wash: "\uD83D\uDEBF",
  fluid_check: "\uD83D\uDD0D",
  custom: "\uD83D\uDCCB",
};

export function TasksSheet({ onNavigate }: { onNavigate: (vehicleId: string) => void }) {
  const { data, isLoading } = useSWR<{ data: Task[]; total_count: number }>("/tasks?status=pending&per_page=20", { refreshInterval: 30000 });
  const tasks = data?.data || [];

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
