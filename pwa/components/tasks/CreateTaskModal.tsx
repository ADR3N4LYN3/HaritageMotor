"use client";

import { useState, useMemo } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { api, ApiError } from "@/lib/api";

const TASK_TYPES = ["battery_start", "tire_pressure", "wash", "fluid_check", "custom"];

const TASK_TYPE_LABELS: Record<string, string> = {
  battery_start: "Battery Start",
  tire_pressure: "Tire Pressure",
  wash: "Wash",
  fluid_check: "Fluid Check",
  custom: "Custom",
};

const taskIcons: Record<string, string> = {
  battery_start: "\uD83D\uDD0B",
  tire_pressure: "\uD83D\uDD27",
  wash: "\uD83D\uDEBF",
  fluid_check: "\uD83D\uDD0D",
  custom: "\uD83D\uDCCB",
};

export interface CreateTaskModalProps {
  vehicleMap: Map<string, string>;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTaskModal({ vehicleMap, onClose, onCreated }: CreateTaskModalProps) {
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
