import { openDB, IDBPDatabase } from "idb";
import type { PendingAction } from "./types";

const DB_NAME = "heritage-motor";
const DB_VERSION = 1;
const STORE_NAME = "pending_actions";

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  });
}

export async function pushAction(action: Omit<PendingAction, "id" | "created_at" | "status">): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const entry: PendingAction = {
    ...action,
    id,
    created_at: new Date().toISOString(),
    status: "pending",
    photos: [],
  };
  await db.put(STORE_NAME, entry);
  return id;
}

export async function getAllActions(): Promise<PendingAction[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function getActionCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE_NAME);
}

export async function updateActionStatus(id: string, status: PendingAction["status"]): Promise<void> {
  const db = await getDB();
  const action = await db.get(STORE_NAME, id);
  if (action) {
    action.status = status;
    await db.put(STORE_NAME, action);
  }
}

export async function removeAction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

