package vehicle

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/chriis/heritage-motor/internal/db"
	"github.com/chriis/heritage-motor/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// VehicleFilters contains the filter and pagination parameters for listing vehicles.
type VehicleFilters struct {
	Status  string
	Search  string
	BayID   *uuid.UUID
	Page    int
	PerPage int
}

// CreateVehicleRequest holds the data needed to create a new vehicle.
type CreateVehicleRequest struct {
	Make         string     `json:"make" validate:"required"`
	Model        string     `json:"model" validate:"required"`
	Year         *int       `json:"year,omitempty"`
	Color        *string    `json:"color,omitempty"`
	LicensePlate *string    `json:"license_plate,omitempty"`
	VIN          *string    `json:"vin,omitempty"`
	OwnerName    string     `json:"owner_name" validate:"required"`
	OwnerEmail   *string    `json:"owner_email,omitempty"`
	OwnerPhone   *string    `json:"owner_phone,omitempty"`
	OwnerNotes   *string    `json:"owner_notes,omitempty"`
	Notes        *string    `json:"notes,omitempty"`
	Tags         []string   `json:"tags,omitempty"`
	BayID        *uuid.UUID `json:"bay_id,omitempty"`
}

// UpdateVehicleRequest holds the data for updating a vehicle.
type UpdateVehicleRequest struct {
	Make         *string  `json:"make,omitempty"`
	Model        *string  `json:"model,omitempty"`
	Year         *int     `json:"year,omitempty"`
	Color        *string  `json:"color,omitempty"`
	LicensePlate *string  `json:"license_plate,omitempty"`
	VIN          *string  `json:"vin,omitempty"`
	OwnerName    *string  `json:"owner_name,omitempty"`
	OwnerEmail   *string  `json:"owner_email,omitempty"`
	OwnerPhone   *string  `json:"owner_phone,omitempty"`
	OwnerNotes   *string  `json:"owner_notes,omitempty"`
	Status       *string  `json:"status,omitempty"`
	Notes        *string  `json:"notes,omitempty"`
	Tags         []string `json:"tags,omitempty"`
}

// Service provides vehicle business logic backed by a Postgres connection pool.
type Service struct {
	pool *pgxpool.Pool
}

// NewService creates a new vehicle service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// List returns vehicles matching the given filters with pagination.
// Returns the list of vehicles, the total count, and any error.
func (s *Service) List(ctx context.Context, tenantID uuid.UUID, filters VehicleFilters) ([]domain.Vehicle, int, error) {
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.PerPage < 1 || filters.PerPage > 100 {
		filters.PerPage = 20
	}
	offset := (filters.Page - 1) * filters.PerPage

	where := []string{"tenant_id = @tenantID", "deleted_at IS NULL"}
	args := pgx.NamedArgs{"tenantID": tenantID}

	if filters.Status != "" {
		where = append(where, "status = @status")
		args["status"] = filters.Status
	}
	if filters.Search != "" {
		where = append(where, "(make ILIKE @search OR model ILIKE @search OR owner_name ILIKE @search OR license_plate ILIKE @search)")
		args["search"] = "%" + filters.Search + "%"
	}
	if filters.BayID != nil {
		where = append(where, "current_bay_id = @bayID")
		args["bayID"] = *filters.BayID
	}

	whereClause := strings.Join(where, " AND ")

	// Single query with COUNT(*) OVER() to avoid a separate count query.
	query := fmt.Sprintf(`SELECT id, tenant_id, make, model, year, color, license_plate, vin,
		owner_name, owner_email, owner_phone, owner_notes, status, current_bay_id,
		notes, tags, qr_token, created_at, updated_at, deleted_at,
		COUNT(*) OVER() AS total_count
		FROM vehicles WHERE %s
		ORDER BY created_at DESC
		LIMIT @limit OFFSET @offset`, whereClause)
	args["limit"] = filters.PerPage
	args["offset"] = offset

	rows, err := db.Conn(ctx, s.pool).Query(ctx, query, args)
	if err != nil {
		log.Error().Err(err).Msg("failed to query vehicles")
		return nil, 0, fmt.Errorf("querying vehicles: %w", err)
	}
	defer rows.Close()

	vehicles := make([]domain.Vehicle, 0, filters.PerPage)
	var total int
	for rows.Next() {
		var v domain.Vehicle
		if err := rows.Scan(
			&v.ID, &v.TenantID, &v.Make, &v.Model, &v.Year, &v.Color,
			&v.LicensePlate, &v.VIN, &v.OwnerName, &v.OwnerEmail,
			&v.OwnerPhone, &v.OwnerNotes, &v.Status, &v.CurrentBayID,
			&v.Notes, &v.Tags, &v.QRToken, &v.CreatedAt, &v.UpdatedAt, &v.DeletedAt,
			&total,
		); err != nil {
			log.Error().Err(err).Msg("failed to scan vehicle row")
			return nil, 0, fmt.Errorf("scanning vehicle: %w", err)
		}
		vehicles = append(vehicles, v)
	}
	if err := rows.Err(); err != nil {
		log.Error().Err(err).Msg("error iterating vehicle rows")
		return nil, 0, fmt.Errorf("iterating vehicles: %w", err)
	}

	return vehicles, total, nil
}

// GetByID returns a single vehicle by ID within the given tenant.
func (s *Service) GetByID(ctx context.Context, tenantID, vehicleID uuid.UUID) (*domain.Vehicle, error) {
	query := `SELECT id, tenant_id, make, model, year, color, license_plate, vin,
		owner_name, owner_email, owner_phone, owner_notes, status, current_bay_id,
		notes, tags, qr_token, created_at, updated_at, deleted_at
		FROM vehicles
		WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`

	rows, err := db.Conn(ctx, s.pool).Query(ctx, query, vehicleID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("querying vehicle: %w", err)
	}
	defer rows.Close()

	vehicle, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[domain.Vehicle])
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrNotFound{Resource: "vehicle", ID: vehicleID}
		}
		return nil, fmt.Errorf("collecting vehicle: %w", err)
	}

	return &vehicle, nil
}

// Create inserts a new vehicle and records a vehicle_intake event.
// If a bay_id is provided the bay is marked as occupied.
func (s *Service) Create(ctx context.Context, tenantID, userID uuid.UUID, req CreateVehicleRequest) (*domain.Vehicle, error) {
	tx, err := db.Conn(ctx, s.pool).Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	vehicleID := uuid.New()
	now := time.Now().UTC()

	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}

	query := `INSERT INTO vehicles (
		id, tenant_id, make, model, year, color, license_plate, vin,
		owner_name, owner_email, owner_phone, owner_notes,
		status, current_bay_id, notes, tags, qr_token, created_at, updated_at
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8,
		$9, $10, $11, $12,
		$13, $14, $15, $16, NULL, $17, $18
	)
	RETURNING id, tenant_id, make, model, year, color, license_plate, vin,
		owner_name, owner_email, owner_phone, owner_notes, status, current_bay_id,
		notes, tags, qr_token, created_at, updated_at, deleted_at`

	status := domain.VehicleStatusStored

	rows, err := tx.Query(ctx, query,
		vehicleID, tenantID, req.Make, req.Model, req.Year, req.Color,
		req.LicensePlate, req.VIN, req.OwnerName, req.OwnerEmail,
		req.OwnerPhone, req.OwnerNotes, status, req.BayID, req.Notes,
		tags, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting vehicle: %w", err)
	}
	defer rows.Close()

	vehicle, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[domain.Vehicle])
	if err != nil {
		return nil, fmt.Errorf("collecting new vehicle: %w", err)
	}

	// If a bay was assigned, mark it as occupied.
	if req.BayID != nil {
		_, err = tx.Exec(ctx,
			"UPDATE bays SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4",
			domain.BayStatusOccupied, now, *req.BayID, tenantID,
		)
		if err != nil {
			return nil, fmt.Errorf("updating bay status: %w", err)
		}
	}

	// Record vehicle_intake event.
	metadata := map[string]interface{}{
		"make":  req.Make,
		"model": req.Model,
	}
	if req.BayID != nil {
		metadata["bay_id"] = req.BayID.String()
	}
	if err := s.insertEvent(ctx, tx, tenantID, vehicleID, userID, domain.EventTypeVehicleIntake, metadata, nil, req.Notes, now); err != nil {
		return nil, fmt.Errorf("inserting intake event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return &vehicle, nil
}

// Update applies partial updates to an existing vehicle.
func (s *Service) Update(ctx context.Context, tenantID, vehicleID uuid.UUID, req UpdateVehicleRequest) (*domain.Vehicle, error) {
	setClauses := []string{}
	args := pgx.NamedArgs{
		"id":       vehicleID,
		"tenantID": tenantID,
	}

	if req.Make != nil {
		setClauses = append(setClauses, "make = @make")
		args["make"] = *req.Make
	}
	if req.Model != nil {
		setClauses = append(setClauses, "model = @model")
		args["model"] = *req.Model
	}
	if req.Year != nil {
		setClauses = append(setClauses, "year = @year")
		args["year"] = *req.Year
	}
	if req.Color != nil {
		setClauses = append(setClauses, "color = @color")
		args["color"] = *req.Color
	}
	if req.LicensePlate != nil {
		setClauses = append(setClauses, "license_plate = @licensePlate")
		args["licensePlate"] = *req.LicensePlate
	}
	if req.VIN != nil {
		setClauses = append(setClauses, "vin = @vin")
		args["vin"] = *req.VIN
	}
	if req.OwnerName != nil {
		setClauses = append(setClauses, "owner_name = @ownerName")
		args["ownerName"] = *req.OwnerName
	}
	if req.OwnerEmail != nil {
		setClauses = append(setClauses, "owner_email = @ownerEmail")
		args["ownerEmail"] = *req.OwnerEmail
	}
	if req.OwnerPhone != nil {
		setClauses = append(setClauses, "owner_phone = @ownerPhone")
		args["ownerPhone"] = *req.OwnerPhone
	}
	if req.OwnerNotes != nil {
		setClauses = append(setClauses, "owner_notes = @ownerNotes")
		args["ownerNotes"] = *req.OwnerNotes
	}
	if req.Status != nil {
		setClauses = append(setClauses, "status = @status")
		args["status"] = *req.Status
	}
	if req.Notes != nil {
		setClauses = append(setClauses, "notes = @notes")
		args["notes"] = *req.Notes
	}
	if req.Tags != nil {
		setClauses = append(setClauses, "tags = @tags")
		args["tags"] = req.Tags
	}

	if len(setClauses) == 0 {
		return s.GetByID(ctx, tenantID, vehicleID)
	}

	setClauses = append(setClauses, "updated_at = @updatedAt")
	args["updatedAt"] = time.Now().UTC()

	query := fmt.Sprintf(`UPDATE vehicles SET %s
		WHERE id = @id AND tenant_id = @tenantID AND deleted_at IS NULL
		RETURNING id, tenant_id, make, model, year, color, license_plate, vin,
			owner_name, owner_email, owner_phone, owner_notes, status, current_bay_id,
			notes, tags, qr_token, created_at, updated_at, deleted_at`,
		strings.Join(setClauses, ", "))

	rows, err := db.Conn(ctx, s.pool).Query(ctx, query, args)
	if err != nil {
		return nil, fmt.Errorf("updating vehicle: %w", err)
	}
	defer rows.Close()

	vehicle, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[domain.Vehicle])
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrNotFound{Resource: "vehicle", ID: vehicleID}
		}
		return nil, fmt.Errorf("collecting updated vehicle: %w", err)
	}

	return &vehicle, nil
}

// Delete performs a soft-delete on the vehicle.
func (s *Service) Delete(ctx context.Context, tenantID, vehicleID uuid.UUID) error {
	now := time.Now().UTC()
	tag, err := db.Conn(ctx, s.pool).Exec(ctx,
		"UPDATE vehicles SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL",
		now, vehicleID, tenantID,
	)
	if err != nil {
		return fmt.Errorf("soft-deleting vehicle: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return &domain.ErrNotFound{Resource: "vehicle", ID: vehicleID}
	}
	return nil
}

// Move transfers a vehicle to a different bay. It updates the old bay to 'free',
// the new bay to 'occupied', and records a vehicle_moved event.
func (s *Service) Move(ctx context.Context, tenantID, userID, vehicleID, toBayID uuid.UUID, reason string) error {
	tx, err := db.Conn(ctx, s.pool).Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now().UTC()

	// Fetch current bay assignment.
	var currentBayID *uuid.UUID
	err = tx.QueryRow(ctx,
		"SELECT current_bay_id FROM vehicles WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
		vehicleID, tenantID,
	).Scan(&currentBayID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return &domain.ErrNotFound{Resource: "vehicle", ID: vehicleID}
		}
		return fmt.Errorf("fetching vehicle for move: %w", err)
	}

	// Free the old bay if one was assigned.
	if currentBayID != nil {
		_, err = tx.Exec(ctx,
			"UPDATE bays SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4",
			domain.BayStatusFree, now, *currentBayID, tenantID,
		)
		if err != nil {
			return fmt.Errorf("freeing old bay: %w", err)
		}
	}

	// Mark the destination bay as occupied.
	_, err = tx.Exec(ctx,
		"UPDATE bays SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4",
		domain.BayStatusOccupied, now, toBayID, tenantID,
	)
	if err != nil {
		return fmt.Errorf("occupying new bay: %w", err)
	}

	// Move the vehicle to the new bay.
	_, err = tx.Exec(ctx,
		"UPDATE vehicles SET current_bay_id = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4",
		toBayID, now, vehicleID, tenantID,
	)
	if err != nil {
		return fmt.Errorf("updating vehicle bay: %w", err)
	}

	// Record vehicle_moved event.
	metadata := map[string]interface{}{
		"to_bay_id": toBayID.String(),
	}
	if currentBayID != nil {
		metadata["from_bay_id"] = currentBayID.String()
	}
	if reason != "" {
		metadata["reason"] = reason
	}

	var notes *string
	if reason != "" {
		notes = &reason
	}

	if err := s.insertEvent(ctx, tx, tenantID, vehicleID, userID, domain.EventTypeVehicleMoved, metadata, nil, notes, now); err != nil {
		return fmt.Errorf("inserting move event: %w", err)
	}

	return tx.Commit(ctx)
}

// Exit marks a vehicle as out, frees its bay, and records a vehicle_exit event.
func (s *Service) Exit(ctx context.Context, tenantID, userID, vehicleID uuid.UUID, notes string) error {
	tx, err := db.Conn(ctx, s.pool).Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now().UTC()

	// Fetch current bay assignment.
	var currentBayID *uuid.UUID
	err = tx.QueryRow(ctx,
		"SELECT current_bay_id FROM vehicles WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
		vehicleID, tenantID,
	).Scan(&currentBayID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return &domain.ErrNotFound{Resource: "vehicle", ID: vehicleID}
		}
		return fmt.Errorf("fetching vehicle for exit: %w", err)
	}

	// Free the bay if one was assigned.
	if currentBayID != nil {
		_, err = tx.Exec(ctx,
			"UPDATE bays SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4",
			domain.BayStatusFree, now, *currentBayID, tenantID,
		)
		if err != nil {
			return fmt.Errorf("freeing bay on exit: %w", err)
		}
	}

	// Mark the vehicle as out and clear bay assignment.
	tag, err := tx.Exec(ctx,
		"UPDATE vehicles SET status = $1, current_bay_id = NULL, updated_at = $2 WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL",
		domain.VehicleStatusOut, now, vehicleID, tenantID,
	)
	if err != nil {
		return fmt.Errorf("updating vehicle on exit: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return &domain.ErrNotFound{Resource: "vehicle", ID: vehicleID}
	}

	// Record vehicle_exit event.
	metadata := map[string]interface{}{}
	if currentBayID != nil {
		metadata["from_bay_id"] = currentBayID.String()
	}
	var eventNotes *string
	if notes != "" {
		eventNotes = &notes
	}

	if err := s.insertEvent(ctx, tx, tenantID, vehicleID, userID, domain.EventTypeVehicleExit, metadata, nil, eventNotes, now); err != nil {
		return fmt.Errorf("inserting exit event: %w", err)
	}

	return tx.Commit(ctx)
}

// GetTimeline returns paginated events for a specific vehicle.
func (s *Service) GetTimeline(ctx context.Context, tenantID, vehicleID uuid.UUID, page, perPage int) ([]domain.Event, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	// Single query with COUNT(*) OVER() to avoid a separate count query.
	query := `SELECT id, tenant_id, vehicle_id, user_id, event_type, metadata,
		photo_keys, notes, occurred_at, source,
		COUNT(*) OVER() AS total_count
		FROM events
		WHERE vehicle_id = $1 AND tenant_id = $2
		ORDER BY occurred_at DESC
		LIMIT $3 OFFSET $4`

	rows, err := db.Conn(ctx, s.pool).Query(ctx, query, vehicleID, tenantID, perPage, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("querying events: %w", err)
	}
	defer rows.Close()

	events := make([]domain.Event, 0, perPage)
	var total int
	for rows.Next() {
		var ev domain.Event
		if err := rows.Scan(
			&ev.ID, &ev.TenantID, &ev.VehicleID, &ev.UserID, &ev.EventType,
			&ev.Metadata, &ev.PhotoKeys, &ev.Notes, &ev.OccurredAt, &ev.Source,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("scanning event: %w", err)
		}
		events = append(events, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating events: %w", err)
	}

	return events, total, nil
}

// insertEvent is a helper that inserts an event row within the given transaction.
func (s *Service) insertEvent(ctx context.Context, tx pgx.Tx, tenantID, vehicleID, userID uuid.UUID, eventType string, metadata map[string]interface{}, photoKeys []string, notes *string, occurredAt time.Time) error {
	eventID := uuid.New()

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("marshalling event metadata: %w", err)
	}

	if photoKeys == nil {
		photoKeys = []string{}
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO events (id, tenant_id, vehicle_id, user_id, event_type, metadata, photo_keys, notes, occurred_at, source)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		eventID, tenantID, vehicleID, userID, eventType, metadataJSON, photoKeys, notes, occurredAt, "api",
	)
	if err != nil {
		return fmt.Errorf("inserting event: %w", err)
	}

	log.Info().
		Str("event_id", eventID.String()).
		Str("event_type", eventType).
		Str("vehicle_id", vehicleID.String()).
		Msg("event recorded")

	return nil
}
