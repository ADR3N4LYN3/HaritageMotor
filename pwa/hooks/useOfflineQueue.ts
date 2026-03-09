"use client";

import { useEffect, useCallback } from "react";
import { useAppStore } from "@/store/app.store";
import { getAllActions, getActionCount, removeAction, updateActionStatus } from "@/lib/offline-queue";
import { api } from "@/lib/api";
import type { PendingAction } from "@/lib/types";

const MAX_RETRY_DELAY = 30000;

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

  // Listen for online events
  useEffect(() => {
    refreshCount();

    const handleOnline = () => {
      syncAll();
    };

    window.addEventListener("online", handleOnline);

    // Periodic sync every 30 seconds if online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncAll();
      }
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, [syncAll, refreshCount]);

  return { syncAll, refreshCount };
}

async function syncAction(action: PendingAction, retryCount = 0): Promise<void> {
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
      case "photo":
        // Photos are handled as FormData - skip in offline sync for now
        break;
    }

    await removeAction(action.id);
  } catch (err: unknown) {
    const apiErr = err as { status?: number };
    if (apiErr?.status && apiErr.status >= 400 && apiErr.status < 500) {
      // Client error - mark as failed, don't retry
      await updateActionStatus(action.id, "failed");
    } else {
      // Network error - retry with exponential backoff
      await updateActionStatus(action.id, "pending");
      if (retryCount < 5) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), MAX_RETRY_DELAY);
        await new Promise((resolve) => setTimeout(resolve, delay));
        await syncAction(action, retryCount + 1);
      }
    }
  }
}
