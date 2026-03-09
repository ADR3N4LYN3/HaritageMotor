export type VehicleStatus = "stored" | "out" | "transit" | "maintenance" | "sold";
export type BayStatus = "free" | "occupied" | "reserved" | "maintenance";
export type TaskStatus = "pending" | "completed" | "overdue" | "cancelled";

export interface Vehicle {
  id: string;
  tenant_id: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  license_plate?: string;
  vin?: string;
  qr_token?: string;
  owner_name: string;
  owner_email?: string;
  owner_phone?: string;
  owner_notes?: string;
  status: VehicleStatus;
  current_bay_id?: string;
  notes?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Bay {
  id: string;
  tenant_id: string;
  code: string;
  zone?: string;
  description?: string;
  qr_token?: string;
  status: BayStatus;
  features: string[];
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  user_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  photo_keys: string[];
  notes?: string;
  occurred_at: string;
  source: string;
}

export interface Task {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  assigned_to?: string;
  task_type: string;
  title: string;
  description?: string;
  status: TaskStatus;
  due_date?: string;
  completed_at?: string;
  completed_by?: string;
  recurrence_days?: number;
  next_due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  totp_enabled: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ScanResult {
  entity_type: "vehicle" | "bay";
  entity_id: string;
  entity_name: string;
  actions: string[];
}

export interface PendingAction {
  id: string;
  type: "move" | "task" | "photo" | "exit";
  vehicle_id: string;
  payload: Record<string, unknown>;
  photos: Blob[];
  created_at: string;
  status: "pending" | "syncing" | "failed";
}

export interface PaginatedResponse<T> {
  data: T[];
  total_count: number;
  page: number;
  per_page: number;
}
