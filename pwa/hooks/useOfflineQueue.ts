"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/store/app.store";
import { getAllActions, getActionCount, removeAction, updateActionStatus } from "@/lib/offline-queue";
import { api } from "@/lib/api";
import type { PendingAction } from "@/lib/types";

const MAX_RETRIES = 2;
const MAX_RETRY_DELAY = 10000;

export function useOfflineQueue() {
  const setPendingCount = useAppStore((s) => s.setPendingCount);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getActionCount();
      setPendingCount(count);
    } catch {
      // IndexedDB not available
    }
  }, [setPendingCount]);

  const syncAll = useCallback(async () => {
    try {
      const actions = await getAllActions();
      const pending = actions
        .filter((a) => a.status === "pending")
        .sort((a, b) => a.created_at.localeCompare(b.created_at));

      for (const action of pending) {
        await syncAction(action);
      }
      await refreshCount();
    } catch {
      // Ignore sync errors
    }
  }, [refreshCount]);

  const pendingCount = useAppStore((s) => s.pendingCount);
  const pendingCountRef = useRef(pendingCount);
  useEffect(() => {
    pendingCountRef.current = pendingCount;
  }, [pendingCount]);

  // Initial count load (runs once).
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Listen for online events and poll only when there are pending actions.
  useEffect(() => {
    const handleOnline = () => {
      syncAll();
    };

    window.addEventListener("online", handleOnline);

    const interval = setInterval(() => {
      if (navigator.onLine && pendingCountRef.current > 0) {
        syncAll();
      }
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, [syncAll]);

  return { syncAll, refreshCount };
}

async function syncAction(action: PendingAction): Promise<void> {
  // Photos are FormData and cannot be serialized to IndexedDB — discard stale entries.
  if (action.type === "photo") {
    await removeAction(action.id);
    return;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await updateActionStatus(action.id, "syncing");

      switch (action.type) {
        case "move":
          await api.post(`/vehicles/${action.vehicle_id}/move`, action.payload);
          break;
        case "task": {
          const taskId = (action.payload as Record<string, unknown>).task_id;
          await api.post(`/tasks/${taskId}/complete`, action.payload);
          break;
        }
        case "exit":
          await api.post(`/vehicles/${action.vehicle_id}/exit`, action.payload);
          break;
      }

      await removeAction(action.id);
      return;
    } catch (err: unknown) {
      const status = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
      if (status >= 400 && status < 500) {
        // Client error — mark as failed, don't retry
        await updateActionStatus(action.id, "failed");
        return;
      }
      // Network error — retry with exponential backoff (limited retries)
      await updateActionStatus(action.id, "pending");
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, attempt), MAX_RETRY_DELAY);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
