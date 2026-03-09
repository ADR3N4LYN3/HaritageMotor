package domain

import (
	"time"

	"github.com/google/uuid"
)

// User roles
const (
	RoleAdmin      = "admin"
	RoleOperator   = "operator"
	RoleTechnician = "technician"
	RoleViewer     = "viewer"
	RoleSuperAdmin = "superadmin"
)

// Tenant statuses
const (
	TenantStatusActive    = "active"
	TenantStatusSuspended = "suspended"
	TenantStatusTrial     = "trial"
)

// Vehicle statuses
const (
	VehicleStatusStored      = "stored"
	VehicleStatusOut         = "out"
	VehicleStatusTransit     = "transit"
	VehicleStatusMaintenance = "maintenance"
	VehicleStatusSold        = "sold"
)

// Bay statuses
const (
	BayStatusFree        = "free"
	BayStatusOccupied    = "occupied"
	BayStatusReserved    = "reserved"
	BayStatusMaintenance = "maintenance"
)

// Event types
const (
	EventTypeVehicleIntake    = "vehicle_intake"
	EventTypeVehicleExit      = "vehicle_exit"
	EventTypeVehicleMoved     = "vehicle_moved"
	EventTypeTaskCompleted    = "task_completed"
	EventTypeDocumentAdded    = "document_added"
	EventTypePhotoAdded       = "photo_added"
	EventTypeStatusChanged    = "status_changed"
	EventTypeNoteAdded        = "note_added"
	EventTypeIncidentReported = "incident_reported"
)

// Task types
const (
	TaskTypeBatteryStart  = "battery_start"
	TaskTypeTirePressure  = "tire_pressure"
	TaskTypeWash          = "wash"
	TaskTypeFluidCheck    = "fluid_check"
	TaskTypeCustom        = "custom"
)

// Task statuses
const (
	TaskStatusPending   = "pending"
	TaskStatusCompleted = "completed"
	TaskStatusOverdue   = "overdue"
	TaskStatusCancelled = "cancelled"
)

// Document types
const (
	DocTypeStorageContract  = "storage_contract"
	DocTypeInsurance        = "insurance"
	DocTypeMandate          = "mandate"
	DocTypeTechnicalControl = "technical_control"
	DocTypeExpertise        = "expertise"
	DocTypeOther            = "other"
)

// ValidVehicleStatus checks if a vehicle status value is in the allowed set.
func ValidVehicleStatus(s string) bool {
	switch s {
	case VehicleStatusStored, VehicleStatusOut, VehicleStatusTransit,
		VehicleStatusMaintenance, VehicleStatusSold:
		return true
	}
	return false
}

// ValidDocType checks if a document type value is in the allowed set.
func ValidDocType(s string) bool {
	switch s {
	case DocTypeStorageContract, DocTypeInsurance, DocTypeMandate,
		DocTypeTechnicalControl, DocTypeExpertise, DocTypeOther:
		return true
	}
	return false
}

type Tenant struct {
	ID        uuid.UUID  `json:"id"`
	Name      string     `json:"name"`
	Slug      string     `json:"slug"`
	Country   string     `json:"country"`
	Timezone  string     `json:"timezone"`
	Plan      string     `json:"plan"`
	Active    bool       `json:"active"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
}

type User struct {
	ID                     uuid.UUID  `json:"id"`
	TenantID               *uuid.UUID `json:"tenant_id,omitempty"`
	Email                  string     `json:"email"`
	PasswordHash           string     `json:"-"`
	FirstName              string     `json:"first_name"`
	LastName               string     `json:"last_name"`
	Role                   string     `json:"role"`
	TOTPSecret             *string    `json:"-"`
	TOTPEnabled            bool       `json:"totp_enabled"`
	PasswordChangeRequired bool       `json:"password_change_required,omitempty"`
	LastLoginAt            *time.Time `json:"last_login_at,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
	DeletedAt              *time.Time `json:"deleted_at,omitempty"`
}

type Vehicle struct {
	ID           uuid.UUID  `json:"id"`
	TenantID     uuid.UUID  `json:"tenant_id"`
	Make         string     `json:"make"`
	Model        string     `json:"model"`
	Year         *int       `json:"year,omitempty"`
	Color        *string    `json:"color,omitempty"`
	LicensePlate *string    `json:"license_plate,omitempty"`
	VIN          *string    `json:"vin,omitempty"`
	OwnerName    string     `json:"owner_name"`
	OwnerEmail   *string    `json:"owner_email,omitempty"`
	OwnerPhone   *string    `json:"owner_phone,omitempty"`
	OwnerNotes   *string    `json:"owner_notes,omitempty"`
	Status       string     `json:"status"`
	CurrentBayID *uuid.UUID `json:"current_bay_id,omitempty"`
	Notes        *string    `json:"notes,omitempty"`
	Tags         []string   `json:"tags"`
	QRToken      *string    `json:"qr_token,omitempty" db:"qr_token"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at,omitempty"`
}

type Bay struct {
	ID          uuid.UUID  `json:"id"`
	TenantID    uuid.UUID  `json:"tenant_id"`
	Code        string     `json:"code"`
	Zone        *string    `json:"zone,omitempty"`
	Description *string    `json:"description,omitempty"`
	Status      string     `json:"status"`
	Features    []string   `json:"features"`
	QRToken     *string    `json:"qr_token,omitempty" db:"qr_token"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type Event struct {
	ID         uuid.UUID              `json:"id"`
	TenantID   uuid.UUID              `json:"tenant_id"`
	VehicleID  uuid.UUID              `json:"vehicle_id"`
	UserID     uuid.UUID              `json:"user_id"`
	EventType  string                 `json:"event_type"`
	Metadata   map[string]interface{} `json:"metadata"`
	PhotoKeys  []string               `json:"photo_keys"`
	Notes      *string                `json:"notes,omitempty"`
	OccurredAt time.Time              `json:"occurred_at"`
	Source     string                 `json:"source"`
}

type Task struct {
	ID             uuid.UUID  `json:"id"`
	TenantID       uuid.UUID  `json:"tenant_id"`
	VehicleID      uuid.UUID  `json:"vehicle_id"`
	AssignedTo     *uuid.UUID `json:"assigned_to,omitempty"`
	TaskType       string     `json:"task_type"`
	Title          string     `json:"title"`
	Description    *string    `json:"description,omitempty"`
	Status         string     `json:"status"`
	DueDate        *time.Time `json:"due_date,omitempty"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	CompletedBy    *uuid.UUID `json:"completed_by,omitempty"`
	RecurrenceDays *int       `json:"recurrence_days,omitempty"`
	NextDueDate    *time.Time `json:"next_due_date,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
}

type Document struct {
	ID         uuid.UUID  `json:"id"`
	TenantID   uuid.UUID  `json:"tenant_id"`
	VehicleID  uuid.UUID  `json:"vehicle_id"`
	UploadedBy uuid.UUID  `json:"uploaded_by"`
	DocType    string     `json:"doc_type"`
	Filename   string     `json:"filename"`
	S3Key      string     `json:"s3_key"`
	MimeType   string     `json:"mime_type"`
	SizeBytes  int64      `json:"size_bytes"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	Notes      *string    `json:"notes,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	DeletedAt  *time.Time `json:"deleted_at,omitempty"`
}

type AuditEntry struct {
	ID           uuid.UUID              `json:"id"`
	TenantID     uuid.UUID              `json:"tenant_id"`
	UserID       *uuid.UUID             `json:"user_id,omitempty"`
	Action       string                 `json:"action"`
	ResourceType string                 `json:"resource_type"`
	ResourceID   *uuid.UUID             `json:"resource_id,omitempty"`
	OldValues    map[string]interface{} `json:"old_values,omitempty"`
	NewValues    map[string]interface{} `json:"new_values,omitempty"`
	IPAddress    *string                `json:"ip_address,omitempty"`
	UserAgent    *string                `json:"user_agent,omitempty"`
	RequestID    *string                `json:"request_id,omitempty"`
	OccurredAt   time.Time              `json:"occurred_at"`
}

type RefreshToken struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	TenantID  *uuid.UUID `json:"tenant_id,omitempty"`
	Token     string     `json:"-"`
	ExpiresAt time.Time  `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
}

type PlanLimit struct {
	Plan     string `json:"plan"`
	Resource string `json:"resource"`
	MaxCount int    `json:"max_count"`
}

type Invitation struct {
	ID               uuid.UUID  `json:"id"`
	TenantID         uuid.UUID  `json:"tenant_id"`
	Email            string     `json:"email"`
	Role             string     `json:"role"`
	InvitedBy        uuid.UUID  `json:"invited_by"`
	TempPasswordHash string     `json:"-"`
	AcceptedAt       *time.Time `json:"accepted_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
}
