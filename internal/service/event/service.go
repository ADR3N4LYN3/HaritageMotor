package event

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/chriis/heritage-motor/internal/db"
	"github.com/chriis/heritage-motor/internal/domain"
)

// Manual event types that users can create directly.
var manualEventTypes = map[string]bool{
	domain.EventTypeNoteAdded:        true,
	domain.EventTypeIncidentReported: true,
	domain.EventTypePhotoAdded:       true,
}

type EventFilters struct {
	VehicleID *uuid.UUID
	EventType *string
	DateFrom  *time.Time
	DateTo    *time.Time
	Page      int
	PerPage   int
}

type CreateEventRequest struct {
	VehicleID uuid.UUID              `json:"vehicle_id" validate:"required"`
	EventType string                 `json:"event_type" validate:"required"`
	Metadata  map[string]interface{} `json:"metadata"`
	PhotoKeys []string               `json:"photo_keys"`
	Notes     *string                `json:"notes"`
}

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func (s *Service) List(ctx context.Context, tenantID uuid.UUID, filters EventFilters) ([]domain.Event, int, error) {
	// Normalise pagination
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.PerPage < 1 || filters.PerPage > 100 {
		filters.PerPage = 20
	}
	offset := (filters.Page - 1) * filters.PerPage

	where := []string{"tenant_id = @tenantID"}
	args := pgx.NamedArgs{"tenantID": tenantID}

	if filters.VehicleID != nil {
		where = append(where, "vehicle_id = @vehicleID")
		args["vehicleID"] = *filters.VehicleID
	}
	if filters.EventType != nil {
		where = append(where, "event_type = @eventType")
		args["eventType"] = *filters.EventType
	}
	if filters.DateFrom != nil {
		where = append(where, "occurred_at >= @dateFrom")
		args["dateFrom"] = *filters.DateFrom
	}
	if filters.DateTo != nil {
		where = append(where, "occurred_at <= @dateTo")
		args["dateTo"] = *filters.DateTo
	}

	whereClause := strings.Join(where, " AND ")
	args["limit"] = filters.PerPage
	args["offset"] = offset

	// Single query with COUNT(*) OVER() to avoid a separate count query.
	query := fmt.Sprintf(
		`SELECT id, tenant_id, vehicle_id, user_id, event_type, metadata, photo_keys, notes, occurred_at, source,
		 COUNT(*) OVER() AS total_count
		 FROM events WHERE %s
		 ORDER BY occurred_at DESC
		 LIMIT @limit OFFSET @offset`,
		whereClause,
	)

	rows, err := db.Conn(ctx, s.pool).Query(ctx, query, args)
	if err != nil {
		log.Error().Err(err).Msg("failed to query events")
		return nil, 0, fmt.Errorf("query events: %w", err)
	}
	defer rows.Close()

	var total int
	events := make([]domain.Event, 0, filters.PerPage)
	for rows.Next() {
		var ev domain.Event
		var metadataJSON []byte
		if err := rows.Scan(
			&ev.ID, &ev.TenantID, &ev.VehicleID, &ev.UserID,
			&ev.EventType, &metadataJSON, &ev.PhotoKeys,
			&ev.Notes, &ev.OccurredAt, &ev.Source,
			&total,
		); err != nil {
			log.Error().Err(err).Msg("failed to scan event row")
			return nil, 0, fmt.Errorf("scan event: %w", err)
		}

		if metadataJSON != nil {
			if err := json.Unmarshal(metadataJSON, &ev.Metadata); err != nil {
				log.Error().Err(err).Str("event_id", ev.ID.String()).Msg("corrupt event metadata JSON")
				ev.Metadata = map[string]interface{}{"_error": "metadata corrupted"}
			}
		}
		if ev.Metadata == nil {
			ev.Metadata = make(map[string]interface{})
		}
		if ev.PhotoKeys == nil {
			ev.PhotoKeys = []string{}
		}

		events = append(events, ev)
	}
	if err := rows.Err(); err != nil {
		log.Error().Err(err).Msg("error iterating event rows")
		return nil, 0, fmt.Errorf("iterate events: %w", err)
	}

	return events, total, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, eventID uuid.UUID) (*domain.Event, error) {
	var ev domain.Event
	var metadataJSON []byte

	err := db.Conn(ctx, s.pool).QueryRow(ctx,
		`SELECT id, tenant_id, vehicle_id, user_id, event_type, metadata, photo_keys, notes, occurred_at, source
		 FROM events
		 WHERE id = $1 AND tenant_id = $2`,
		eventID, tenantID,
	).Scan(
		&ev.ID, &ev.TenantID, &ev.VehicleID, &ev.UserID,
		&ev.EventType, &metadataJSON, &ev.PhotoKeys,
		&ev.Notes, &ev.OccurredAt, &ev.Source,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrNotFound{Resource: "event", ID: eventID}
		}
		log.Error().Err(err).Str("event_id", eventID.String()).Msg("failed to get event")
		return nil, fmt.Errorf("get event: %w", err)
	}

	if metadataJSON != nil {
		if err := json.Unmarshal(metadataJSON, &ev.Metadata); err != nil {
			log.Error().Err(err).Str("event_id", ev.ID.String()).Msg("corrupt event metadata JSON")
			ev.Metadata = map[string]interface{}{"_error": "metadata corrupted"}
		}
	}
	if ev.Metadata == nil {
		ev.Metadata = make(map[string]interface{})
	}
	if ev.PhotoKeys == nil {
		ev.PhotoKeys = []string{}
	}

	return &ev, nil
}

func (s *Service) Create(ctx context.Context, tenantID, userID uuid.UUID, req CreateEventRequest) (*domain.Event, error) {
	if !manualEventTypes[req.EventType] {
		return nil, &domain.ErrValidation{
			Field:   "event_type",
			Message: fmt.Sprintf("manual creation only allowed for: note_added, incident_reported, photo_added"),
		}
	}

	var metadataJSON []byte
	if req.Metadata != nil {
		var err error
		metadataJSON, err = json.Marshal(req.Metadata)
		if err != nil {
			return nil, &domain.ErrValidation{Field: "metadata", Message: "invalid metadata"}
		}
	}

	if req.PhotoKeys == nil {
		req.PhotoKeys = []string{}
	}

	ev := domain.Event{
		ID:         uuid.New(),
		TenantID:   tenantID,
		VehicleID:  req.VehicleID,
		UserID:     userID,
		EventType:  req.EventType,
		Metadata:   req.Metadata,
		PhotoKeys:  req.PhotoKeys,
		Notes:      req.Notes,
		OccurredAt: time.Now().UTC(),
		Source:     "manual",
	}
	if ev.Metadata == nil {
		ev.Metadata = make(map[string]interface{})
	}

	_, err := db.Conn(ctx, s.pool).Exec(ctx,
		`INSERT INTO events (id, tenant_id, vehicle_id, user_id, event_type, metadata, photo_keys, notes, occurred_at, source)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		ev.ID, ev.TenantID, ev.VehicleID, ev.UserID,
		ev.EventType, metadataJSON, ev.PhotoKeys,
		ev.Notes, ev.OccurredAt, ev.Source,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to insert event")
		return nil, fmt.Errorf("insert event: %w", err)
	}

	log.Info().
		Str("event_id", ev.ID.String()).
		Str("type", ev.EventType).
		Str("vehicle_id", ev.VehicleID.String()).
		Msg("event created")

	return &ev, nil
}
