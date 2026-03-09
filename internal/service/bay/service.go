package bay

import (
	"context"
	"fmt"
	"strings"

	"github.com/chriis/heritage-motor/internal/db"
	"github.com/chriis/heritage-motor/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

type CreateBayRequest struct {
	Code        string   `json:"code" validate:"required,min=1,max=50"`
	Zone        *string  `json:"zone,omitempty"`
	Description *string  `json:"description,omitempty"`
	Features    []string `json:"features,omitempty"`
}

type UpdateBayRequest struct {
	Code        *string  `json:"code,omitempty"`
	Zone        *string  `json:"zone,omitempty"`
	Description *string  `json:"description,omitempty"`
	Status      *string  `json:"status,omitempty"`
	Features    []string `json:"features,omitempty"`
}

func (s *Service) List(ctx context.Context, tenantID uuid.UUID, status, zone string, page, perPage int) ([]domain.Bay, int, error) {
	// Normalize pagination as safety net
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	where := []string{"tenant_id = @tenantID"}
	args := pgx.NamedArgs{"tenantID": tenantID}

	if status != "" {
		where = append(where, "status = @status")
		args["status"] = status
	}
	if zone != "" {
		where = append(where, "zone = @zone")
		args["zone"] = zone
	}

	whereClause := strings.Join(where, " AND ")
	offset := (page - 1) * perPage
	args["limit"] = perPage
	args["offset"] = offset

	// Single query with COUNT(*) OVER() to avoid a separate count query.
	query := fmt.Sprintf(
		`SELECT id, tenant_id, code, zone, description, status, features, qr_token, created_at, updated_at,
		 COUNT(*) OVER() AS total_count
		 FROM bays WHERE %s
		 ORDER BY code ASC
		 LIMIT @limit OFFSET @offset`, whereClause)

	rows, err := db.Conn(ctx, s.pool).Query(ctx, query, args)
	if err != nil {
		log.Error().Err(err).Msg("failed to list bays")
		return nil, 0, fmt.Errorf("listing bays: %w", err)
	}
	defer rows.Close()

	var total int
	bays := make([]domain.Bay, 0, perPage)
	for rows.Next() {
		var b domain.Bay
		if err := rows.Scan(&b.ID, &b.TenantID, &b.Code, &b.Zone, &b.Description,
			&b.Status, &b.Features, &b.QRToken, &b.CreatedAt, &b.UpdatedAt,
			&total); err != nil {
			log.Error().Err(err).Msg("failed to scan bay")
			return nil, 0, fmt.Errorf("scanning bay: %w", err)
		}
		if b.Features == nil {
			b.Features = []string{}
		}
		bays = append(bays, b)
	}
	if err := rows.Err(); err != nil {
		log.Error().Err(err).Msg("error iterating bay rows")
		return nil, 0, fmt.Errorf("iterate bays: %w", err)
	}

	return bays, total, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, bayID uuid.UUID) (*domain.Bay, error) {
	var b domain.Bay
	err := db.Conn(ctx, s.pool).QueryRow(ctx,
		`SELECT id, tenant_id, code, zone, description, status, features, qr_token, created_at, updated_at
		 FROM bays WHERE id = $1 AND tenant_id = $2`, bayID, tenantID).
		Scan(&b.ID, &b.TenantID, &b.Code, &b.Zone, &b.Description,
			&b.Status, &b.Features, &b.QRToken, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrNotFound{Resource: "bay", ID: bayID}
		}
		log.Error().Err(err).Str("bay_id", bayID.String()).Msg("failed to get bay")
		return nil, fmt.Errorf("getting bay: %w", err)
	}
	if b.Features == nil {
		b.Features = []string{}
	}
	return &b, nil
}

func (s *Service) Create(ctx context.Context, tenantID uuid.UUID, req CreateBayRequest) (*domain.Bay, error) {
	// Check for unique code per tenant
	var exists bool
	err := db.Conn(ctx, s.pool).QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM bays WHERE tenant_id = $1 AND code = $2)`,
		tenantID, req.Code).Scan(&exists)
	if err != nil {
		log.Error().Err(err).Msg("failed to check bay code uniqueness")
		return nil, fmt.Errorf("checking bay code: %w", err)
	}
	if exists {
		return nil, &domain.ErrConflict{Message: fmt.Sprintf("bay with code %q already exists", req.Code)}
	}

	features := req.Features
	if features == nil {
		features = []string{}
	}

	var b domain.Bay
	err = db.Conn(ctx, s.pool).QueryRow(ctx,
		`INSERT INTO bays (tenant_id, code, zone, description, status, features)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, tenant_id, code, zone, description, status, features, qr_token, created_at, updated_at`,
		tenantID, req.Code, req.Zone, req.Description, domain.BayStatusFree, features).
		Scan(&b.ID, &b.TenantID, &b.Code, &b.Zone, &b.Description,
			&b.Status, &b.Features, &b.QRToken, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		log.Error().Err(err).Msg("failed to create bay")
		return nil, fmt.Errorf("creating bay: %w", err)
	}
	if b.Features == nil {
		b.Features = []string{}
	}

	log.Info().Str("bay_id", b.ID.String()).Str("code", b.Code).Msg("bay created")
	return &b, nil
}

func (s *Service) Update(ctx context.Context, tenantID, bayID uuid.UUID, req UpdateBayRequest) (*domain.Bay, error) {
	// Verify bay exists
	existing, err := s.GetByID(ctx, tenantID, bayID)
	if err != nil {
		return nil, err
	}

	// If code is being changed, check uniqueness
	if req.Code != nil && *req.Code != existing.Code {
		var exists bool
		err = db.Conn(ctx, s.pool).QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM bays WHERE tenant_id = $1 AND code = $2 AND id != $3)`,
			tenantID, *req.Code, bayID).Scan(&exists)
		if err != nil {
			log.Error().Err(err).Msg("failed to check bay code uniqueness")
			return nil, fmt.Errorf("checking bay code: %w", err)
		}
		if exists {
			return nil, &domain.ErrConflict{Message: fmt.Sprintf("bay with code %q already exists", *req.Code)}
		}
	}

	// Validate status if provided
	if req.Status != nil {
		switch *req.Status {
		case domain.BayStatusFree, domain.BayStatusOccupied, domain.BayStatusReserved, domain.BayStatusMaintenance:
			// valid
		default:
			return nil, &domain.ErrValidation{Field: "status", Message: fmt.Sprintf("invalid bay status: %s", *req.Status)}
		}
	}

	// Build update
	code := existing.Code
	if req.Code != nil {
		code = *req.Code
	}
	zone := existing.Zone
	if req.Zone != nil {
		zone = req.Zone
	}
	description := existing.Description
	if req.Description != nil {
		description = req.Description
	}
	status := existing.Status
	if req.Status != nil {
		status = *req.Status
	}
	features := existing.Features
	if req.Features != nil {
		features = req.Features
	}

	var b domain.Bay
	err = db.Conn(ctx, s.pool).QueryRow(ctx,
		`UPDATE bays SET code = $1, zone = $2, description = $3, status = $4, features = $5, updated_at = NOW()
		 WHERE id = $6 AND tenant_id = $7
		 RETURNING id, tenant_id, code, zone, description, status, features, qr_token, created_at, updated_at`,
		code, zone, description, status, features, bayID, tenantID).
		Scan(&b.ID, &b.TenantID, &b.Code, &b.Zone, &b.Description,
			&b.Status, &b.Features, &b.QRToken, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		log.Error().Err(err).Str("bay_id", bayID.String()).Msg("failed to update bay")
		return nil, fmt.Errorf("updating bay: %w", err)
	}
	if b.Features == nil {
		b.Features = []string{}
	}

	log.Info().Str("bay_id", b.ID.String()).Msg("bay updated")
	return &b, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, bayID uuid.UUID) error {
	// Try to delete in a single query — only free bays may be deleted.
	ct, err := db.Conn(ctx, s.pool).Exec(ctx,
		`DELETE FROM bays WHERE id = $1 AND tenant_id = $2 AND status = $3`,
		bayID, tenantID, domain.BayStatusFree)
	if err != nil {
		log.Error().Err(err).Str("bay_id", bayID.String()).Msg("failed to delete bay")
		return fmt.Errorf("deleting bay: %w", err)
	}
	if ct.RowsAffected() == 1 {
		log.Info().Str("bay_id", bayID.String()).Msg("bay deleted")
		return nil
	}

	// 0 rows affected — distinguish "not found" from "wrong status".
	var status string
	err = db.Conn(ctx, s.pool).QueryRow(ctx,
		`SELECT status FROM bays WHERE id = $1 AND tenant_id = $2`, bayID, tenantID,
	).Scan(&status)
	if err != nil {
		// Row truly does not exist.
		return &domain.ErrNotFound{Resource: "bay", ID: bayID}
	}
	return &domain.ErrValidation{
		Field:   "status",
		Message: fmt.Sprintf("cannot delete bay with status %q, must be free", status),
	}
}
