package report

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/chriis/heritage-motor/internal/db"
	"github.com/chriis/heritage-motor/internal/domain"
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

type reportData struct {
	Vehicle    domain.Vehicle
	Events     []domain.Event
	Tasks      []domain.Task
	Documents  []domain.Document
	TenantName string
}

func (s *Service) GenerateVehicleReport(ctx context.Context, tenantID, vehicleID uuid.UUID) ([]byte, string, error) {
	data, err := s.loadReportData(ctx, tenantID, vehicleID)
	if err != nil {
		return nil, "", err
	}

	return buildPDF(data)
}

func (s *Service) loadReportData(ctx context.Context, tenantID, vehicleID uuid.UUID) (*reportData, error) {
	conn := db.Conn(ctx, s.pool)

	// Load vehicle
	var v domain.Vehicle
	err := conn.QueryRow(ctx,
		`SELECT id, tenant_id, make, model, year, color, license_plate, vin,
		 owner_name, owner_email, owner_phone, owner_notes, status,
		 current_bay_id, notes, tags, qr_token, created_at, updated_at
		 FROM vehicles WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
		vehicleID, tenantID,
	).Scan(
		&v.ID, &v.TenantID, &v.Make, &v.Model, &v.Year, &v.Color,
		&v.LicensePlate, &v.VIN, &v.OwnerName, &v.OwnerEmail,
		&v.OwnerPhone, &v.OwnerNotes, &v.Status, &v.CurrentBayID,
		&v.Notes, &v.Tags, &v.QRToken, &v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		return nil, &domain.ErrNotFound{Resource: "vehicle", ID: vehicleID}
	}

	// Load tenant name
	var tenantName string
	_ = conn.QueryRow(ctx, `SELECT name FROM tenants WHERE id = $1`, tenantID).Scan(&tenantName) //nolint:errcheck // optional

	// Load events
	rows, err := conn.Query(ctx,
		`SELECT id, tenant_id, vehicle_id, user_id, event_type, metadata, photo_keys, notes, occurred_at, source
		 FROM events WHERE vehicle_id = $1 AND tenant_id = $2
		 ORDER BY occurred_at ASC
		 LIMIT 1000`,
		vehicleID, tenantID,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to load events for report")
		return nil, fmt.Errorf("load events: %w", err)
	}
	defer rows.Close()

	var events []domain.Event
	for rows.Next() {
		var e domain.Event
		err = rows.Scan(&e.ID, &e.TenantID, &e.VehicleID, &e.UserID,
			&e.EventType, &e.Metadata, &e.PhotoKeys, &e.Notes,
			&e.OccurredAt, &e.Source)
		if err != nil {
			return nil, fmt.Errorf("scan event: %w", err)
		}
		events = append(events, e)
	}
	err = rows.Err()
	if err != nil {
		return nil, fmt.Errorf("iterate events: %w", err)
	}

	// Load tasks
	taskRows, err := conn.Query(ctx,
		`SELECT id, tenant_id, vehicle_id, assigned_to, task_type, title, description,
		 status, due_date, completed_at, completed_by, recurrence_days, next_due_date,
		 created_at, updated_at
		 FROM tasks WHERE vehicle_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
		 ORDER BY created_at ASC
		 LIMIT 500`,
		vehicleID, tenantID,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to load tasks for report")
		return nil, fmt.Errorf("load tasks: %w", err)
	}
	defer taskRows.Close()

	var tasks []domain.Task
	for taskRows.Next() {
		var t domain.Task
		err = taskRows.Scan(&t.ID, &t.TenantID, &t.VehicleID, &t.AssignedTo,
			&t.TaskType, &t.Title, &t.Description, &t.Status, &t.DueDate,
			&t.CompletedAt, &t.CompletedBy, &t.RecurrenceDays, &t.NextDueDate,
			&t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan task: %w", err)
		}
		tasks = append(tasks, t)
	}
	err = taskRows.Err()
	if err != nil {
		return nil, fmt.Errorf("iterate tasks: %w", err)
	}

	// Load documents
	docRows, err := conn.Query(ctx,
		`SELECT id, tenant_id, vehicle_id, uploaded_by, doc_type, filename, s3_key,
		 mime_type, size_bytes, expires_at, notes, created_at
		 FROM documents WHERE vehicle_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
		 ORDER BY created_at ASC`,
		vehicleID, tenantID,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to load documents for report")
		return nil, fmt.Errorf("load documents: %w", err)
	}
	defer docRows.Close()

	var docs []domain.Document
	for docRows.Next() {
		var d domain.Document
		err = docRows.Scan(&d.ID, &d.TenantID, &d.VehicleID, &d.UploadedBy,
			&d.DocType, &d.Filename, &d.S3Key, &d.MimeType,
			&d.SizeBytes, &d.ExpiresAt, &d.Notes, &d.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan document: %w", err)
		}
		docs = append(docs, d)
	}
	err = docRows.Err()
	if err != nil {
		return nil, fmt.Errorf("iterate documents: %w", err)
	}

	return &reportData{
		Vehicle:    v,
		Events:     events,
		Tasks:      tasks,
		Documents:  docs,
		TenantName: tenantName,
	}, nil
}
