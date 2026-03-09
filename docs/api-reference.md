# API Reference

Base URL: `https://api.heritagemotor.app/api/v1`

All authenticated endpoints require `Authorization: Bearer <access_token>`.

## Authentication

### POST /auth/login

Login with email and password. Rate limited: 5 req / 15 min per IP.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (no MFA):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "a1b2c3...",
  "user": { "id": "uuid", "email": "...", "role": "operator", ... }
}
```

**Response (MFA required):**
```json
{
  "mfa_required": true,
  "mfa_token": "eyJ..."
}
```

### POST /auth/mfa/verify

Complete login with TOTP code. Rate limited.

**Request:**
```json
{
  "mfa_token": "eyJ...",
  "code": "123456"
}
```

**Response:** Same as successful login (access_token + refresh_token + user).

### POST /auth/refresh

Rotate refresh token. Rate limited.

**Request:**
```json
{
  "refresh_token": "a1b2c3..."
}
```

**Response:** New access_token + refresh_token + user.

### POST /auth/logout
**Auth required.**

```json
{
  "refresh_token": "a1b2c3..."
}
```

**Response:** `{"message": "logged out"}`

### GET /auth/me
**Auth required.**

**Response:** `{"user": { ... }}`

### POST /auth/mfa/setup
**Auth required.**

Generates a TOTP secret. User must call `/auth/mfa/enable` with a valid code to activate.

**Response:**
```json
{
  "secret": "BASE32SECRET",
  "url": "otpauth://totp/Heritage%20Motor:user@example.com?..."
}
```

### POST /auth/mfa/enable
**Auth required.**

```json
{
  "code": "123456"
}
```

**Response:** `{"message": "mfa enabled"}`

### DELETE /auth/mfa
**Auth required. Admin only.**

Query params: `?user_id=<uuid>` (optional, defaults to self)

**Response:** `{"message": "mfa disabled"}`

---

## Vehicles

### GET /vehicles

List vehicles with filters and pagination.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status (stored, out, transit, maintenance, sold) |
| `search` | string | Search in make, model, owner_name, license_plate (ILIKE) |
| `bay_id` | uuid | Filter by current bay |
| `page` | int | Page number (default: 1) |
| `per_page` | int | Items per page (default: 20, max: 100) |

**Response:**
```json
{
  "data": [Vehicle],
  "total_count": 42,
  "page": 1,
  "per_page": 20
}
```

### GET /vehicles/:id

**Response:** Vehicle object.

### POST /vehicles
**Operator+ required.**

**Request:**
```json
{
  "make": "Porsche",
  "model": "911 Carrera",
  "year": 1973,
  "color": "Silver",
  "license_plate": "AB-123-CD",
  "vin": "WP0AB2...",
  "owner_name": "John Doe",
  "owner_email": "john@example.com",
  "owner_phone": "+33612345678",
  "owner_notes": "VIP client",
  "notes": "Requires climate-controlled bay",
  "tags": ["classic", "porsche"],
  "bay_id": "uuid"
}
```

Required: `make`, `model`, `owner_name`. Creates a `vehicle_intake` event. If `bay_id` is provided, marks the bay as occupied.

**Response:** `201` + Vehicle object.

### PATCH /vehicles/:id
**Operator+ required.**

Partial update. Only send fields to change.

```json
{
  "color": "Red",
  "status": "maintenance",
  "tags": ["classic", "restored"]
}
```

**Response:** Updated Vehicle object.

### DELETE /vehicles/:id
**Admin only.**

Soft delete (sets `deleted_at`).

**Response:** `204 No Content`

### POST /vehicles/:id/move
**Operator+ required.**

Move vehicle to a different bay. Frees old bay, marks new bay as occupied, creates `vehicle_moved` event.

```json
{
  "bay_id": "target-bay-uuid",
  "reason": "Client request"
}
```

**Response:** `{"status": "moved"}`

### POST /vehicles/:id/exit
**Operator+ required.**

Mark vehicle as out, free its bay, create `vehicle_exit` event.

```json
{
  "notes": "Picked up by owner"
}
```

**Response:** `{"status": "exited"}`

### GET /vehicles/:id/timeline

Paginated event history for a vehicle.

**Query params:** `page`, `per_page`

**Response:** Paginated list of Event objects.

---

## Bays

### GET /bays

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | free, occupied, reserved, maintenance |
| `zone` | string | Filter by zone |
| `page` | int | Page number |
| `per_page` | int | Items per page |

**Response:** Paginated list of Bay objects.

### GET /bays/:id

**Response:** Bay object.

### POST /bays
**Operator+ required.**

```json
{
  "code": "A-01",
  "zone": "Hall A",
  "description": "Climate-controlled",
  "features": ["climate", "covered"]
}
```

Code must be unique per tenant. **Response:** `201` + Bay object.

### PATCH /bays/:id
**Operator+ required.**

```json
{
  "status": "maintenance",
  "description": "Under renovation"
}
```

**Response:** Updated Bay object.

### DELETE /bays/:id
**Operator+ required.**

Bay must be in `free` status. Hard delete.

**Response:** `204 No Content`

---

## Events

### GET /events

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `vehicle_id` | uuid | Filter by vehicle |
| `type` | string | Filter by event type |
| `date_from` | RFC3339 | Events after this date |
| `date_to` | RFC3339 | Events before this date |
| `page` | int | Page number |
| `per_page` | int | Items per page |

**Response:** Paginated list of Event objects.

### GET /events/:id

**Response:** Event object.

### POST /events
**Technician+ required.**

Manual event creation (limited to: `note_added`, `incident_reported`, `photo_added`).

```json
{
  "vehicle_id": "uuid",
  "event_type": "note_added",
  "metadata": {"key": "value"},
  "photo_keys": ["s3-key-1"],
  "notes": "Battery check passed"
}
```

**Response:** `201` + Event object.

---

## Tasks

### GET /tasks

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | pending, completed, overdue, cancelled |
| `vehicle_id` | uuid | Filter by vehicle |
| `assigned_to` | uuid | Filter by assignee |
| `page` | int | Page number |
| `per_page` | int | Items per page |

**Response:** Paginated list of Task objects.

### GET /tasks/:id

**Response:** Task object.

### POST /tasks
**Technician+ required.**

```json
{
  "vehicle_id": "uuid",
  "assigned_to": "user-uuid",
  "task_type": "battery_start",
  "title": "Weekly battery start",
  "description": "Start engine for 5 minutes",
  "due_date": "2026-03-15T10:00:00Z",
  "recurrence_days": 7
}
```

Task types: `battery_start`, `tire_pressure`, `wash`, `fluid_check`, `custom`.

**Response:** `201` + Task object.

### PATCH /tasks/:id
**Technician+ required.**

Partial update.

**Response:** Updated Task object.

### POST /tasks/:id/complete
**Technician+ required.**

Marks task as completed, records `task_completed` event. If the task has `recurrence_days`, a new pending task is automatically created with the next due date.

**Response:** `{"status": "completed"}`

### DELETE /tasks/:id
**Admin only.**

Soft delete.

**Response:** `204 No Content`

---

## Documents

Documents are nested under vehicles.

### GET /vehicles/:id/documents

List all documents for a vehicle.

**Response:** `{"data": [Document]}`

### GET /vehicles/:id/documents/:docId

**Response:** Document object.

### POST /vehicles/:id/documents
**Technician+ required.**

Multipart form upload.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Max 20MB. Allowed: JPEG, PNG, WebP, HEIC, PDF, DOCX, TXT |
| `doc_type` | string | Yes | storage_contract, insurance, mandate, technical_control, expertise, other |
| `notes` | string | No | Free-text notes |
| `expires_at` | RFC3339 | No | Document expiration date |

**Response:** `201` + Document object.

### DELETE /vehicles/:id/documents/:docId
**Admin only.**

Soft delete.

**Response:** `204 No Content`

---

## Scan (QR Resolution)

### GET /scan/:token

Resolves a QR token to a vehicle or bay.

**Response (vehicle found):**
```json
{
  "entity_type": "vehicle",
  "entity_id": "uuid",
  "entity_name": "Porsche 911 Carrera",
  "actions": ["move", "task", "photo", "exit"]
}
```

Actions depend on role:
- Admin/Operator: `["move", "task", "photo", "exit"]`
- Technician: `["task", "photo"]`
- Viewer: `[]`

**Response (bay found):**
```json
{
  "entity_type": "bay",
  "entity_id": "uuid",
  "entity_name": "A-01",
  "actions": []
}
```

**Response (not found):** `404`

---

## Users (Admin only)

### GET /users

List all users for the tenant.

**Response:** `{"data": [User]}`

### POST /users

```json
{
  "email": "new@example.com",
  "password": "securepass123",
  "first_name": "Jane",
  "last_name": "Doe",
  "role": "technician"
}
```

**Response:** `201` + User object.

### PATCH /users/:id

Partial update.

**Response:** Updated User object.

### DELETE /users/:id

Soft delete.

**Response:** `204 No Content`

---

## Audit Log (Admin only)

### GET /audit

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `user_id` | uuid | Filter by user |
| `resource_type` | string | Filter by resource type |
| `date_from` | string | Start date |
| `date_to` | string | End date |
| `page` | int | Page number |
| `per_page` | int | Items per page |

**Response:** Paginated list of audit entries.

---

## Health Check

### GET /health

No authentication required.

**Response:**
```json
{
  "status": "ok",
  "service": "heritage-motor",
  "database": "connected"
}
```

---

## Common Error Responses

| Status | Body | Meaning |
|--------|------|---------|
| 400 | `{"error": "invalid request body"}` | Malformed JSON or params |
| 401 | `{"error": "unauthorized", "message": "..."}` | Missing/invalid token |
| 403 | `{"error": "forbidden"}` | Insufficient role |
| 404 | `{"error": "not_found", "resource": "..."}` | Resource not found |
| 409 | `{"error": "conflict", "message": "..."}` | Unique constraint violation |
| 413 | `{"error": "file too large, max 20MB"}` | File size exceeded |
| 415 | `{"error": "unsupported file type"}` | MIME type not allowed |
| 422 | `{"error": "validation", ...}` | Validation failure |
| 429 | `{"error": "too many attempts..."}` | Rate limit exceeded |
| 500 | `{"error": "internal"}` | Server error |
