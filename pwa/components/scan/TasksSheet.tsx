"use client";

import useSWR from "swr";
import { useI18n } from "@/lib/i18n";
import { tasksI18n } from "@/lib/translations";
import type { Task } from "@/lib/types";
import { TaskIcon } from "@/lib/task-constants";

export function TasksSheet({ onNavigate }: { onNavigate: (vehicleId: string) => void }) {
  const { t } = useI18n(tasksI18n);
  const { data, isLoading } = useSWR<{ data: Task[]; total_count: number }>("/tasks?status=pending&per_page=20", { refreshInterval: 30000 });
  const tasks = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[1.3rem] font-light tracking-[0.03em] text-white leading-[1.2]">{t.pending}</h2>
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
        <p className="text-white/30 text-sm text-center py-6">{t.noTasks}</p>
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
                  <div className="w-7 h-7 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0 text-gold/70">
                    <TaskIcon type={task.task_type} className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{task.title}</p>
                    {task.due_date && (
                      <p className={`text-xs mt-0.5 ${isOverdue ? "text-danger" : "text-white/40"}`}>
                        {isOverdue ? t.overdue : t.due} {new Date(task.due_date).toLocaleDateString()}
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
