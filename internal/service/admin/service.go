package admin

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/chriis/heritage-motor/internal/auth"
	"github.com/chriis/heritage-motor/internal/domain"
	"github.com/chriis/heritage-motor/internal/middleware"
	"github.com/chriis/heritage-motor/internal/service/mailer"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// TenantWithStats is a tenant augmented with resource counts.
type TenantWithStats struct {
	domain.Tenant
	UserCount    int `json:"user_count"`
	VehicleCount int `json:"vehicle_count"`
	BayCount     int `json:"bay_count"`
}

type CreateTenantRequest struct {
	Name     string `json:"name" validate:"required"`
	Slug     string `json:"slug" validate:"required"`
	Country  string `json:"country" validate:"required"`
	Timezone string `json:"timezone" validate:"required"`
	Plan     string `json:"plan" validate:"required,oneof=starter pro enterprise"`
}

type UpdateTenantRequest struct {
	Name     *string `json:"name"`
	Plan     *string `json:"plan" validate:"omitempty,oneof=starter pro enterprise"`
	Status   *string `json:"status" validate:"omitempty,oneof=active suspended trial"`
}

type InviteUserRequest struct {
	TenantID  uuid.UUID `json:"tenant_id" validate:"required"`
	Email     string    `json:"email" validate:"required,email"`
	FirstName string    `json:"first_name" validate:"required"`
	LastName  string    `json:"last_name" validate:"required"`
	Role      string    `json:"role" validate:"required,oneof=admin operator technician viewer"`
}

type Service struct {
	pool   *pgxpool.Pool
	mailer *mailer.Service
}

func NewService(pool *pgxpool.Pool, mailer *mailer.Service) *Service {
	return &Service{pool: pool, mailer: mailer}
}

// ListTenants returns all tenants with resource counts.
func (s *Service) ListTenants(ctx context.Context, page, perPage int) ([]TenantWithStats, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	rows, err := s.pool.Query(ctx,
		`SELECT t.id, t.name, t.slug, t.country, t.timezone, t.plan, t.active, t.status,
		        t.created_at, t.updated_at, t.deleted_at,
		        COALESCE(uc.cnt, 0) AS user_count,
		        COALESCE(vc.cnt, 0) AS vehicle_count,
		        COALESCE(bc.cnt, 0) AS bay_count,
		        COUNT(*) OVER() AS total_count
		 FROM tenants t
		 LEFT JOIN (SELECT tenant_id, COUNT(*) AS cnt FROM users WHERE deleted_at IS NULL GROUP BY tenant_id) uc ON uc.tenant_id = t.id
		 LEFT JOIN (SELECT tenant_id, COUNT(*) AS cnt FROM vehicles WHERE deleted_at IS NULL GROUP BY tenant_id) vc ON vc.tenant_id = t.id
		 LEFT JOIN (SELECT tenant_id, COUNT(*) AS cnt FROM bays GROUP BY tenant_id) bc ON bc.tenant_id = t.id
		 WHERE t.deleted_at IS NULL
		 ORDER BY t.created_at DESC
		 LIMIT $1 OFFSET $2`,
		perPage, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("query tenants: %w", err)
	}
	defer rows.Close()

	var total int
	tenants := make([]TenantWithStats, 0, perPage)
	for rows.Next() {
		var t TenantWithStats
		if err := rows.Scan(
			&t.ID, &t.Name, &t.Slug, &t.Country, &t.Timezone, &t.Plan, &t.Active, &t.Status,
			&t.CreatedAt, &t.UpdatedAt, &t.DeletedAt,
			&t.UserCount, &t.VehicleCount, &t.BayCount,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("scan tenant: %w", err)
		}
		tenants = append(tenants, t)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate tenants: %w", err)
	}

	return tenants, total, nil
}

// GetTenant returns a single tenant with stats.
// Uses LEFT JOIN (same pattern as ListTenants) instead of correlated subqueries.
func (s *Service) GetTenant(ctx context.Context, tenantID uuid.UUID) (*TenantWithStats, error) {
	var t TenantWithStats
	err := s.pool.QueryRow(ctx,
		`SELECT t.id, t.name, t.slug, t.country, t.timezone, t.plan, t.active, t.status,
		        t.created_at, t.updated_at, t.deleted_at,
		        COALESCE(uc.cnt, 0) AS user_count,
		        COALESCE(vc.cnt, 0) AS vehicle_count,
		        COALESCE(bc.cnt, 0) AS bay_count
		 FROM tenants t
		 LEFT JOIN (SELECT tenant_id, COUNT(*) AS cnt FROM users WHERE deleted_at IS NULL GROUP BY tenant_id) uc ON uc.tenant_id = t.id
		 LEFT JOIN (SELECT tenant_id, COUNT(*) AS cnt FROM vehicles WHERE deleted_at IS NULL GROUP BY tenant_id) vc ON vc.tenant_id = t.id
		 LEFT JOIN (SELECT tenant_id, COUNT(*) AS cnt FROM bays GROUP BY tenant_id) bc ON bc.tenant_id = t.id
		 WHERE t.id = $1 AND t.deleted_at IS NULL`,
		tenantID,
	).Scan(
		&t.ID, &t.Name, &t.Slug, &t.Country, &t.Timezone, &t.Plan, &t.Active, &t.Status,
		&t.CreatedAt, &t.UpdatedAt, &t.DeletedAt,
		&t.UserCount, &t.VehicleCount, &t.BayCount,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrNotFound{Resource: "tenant", ID: tenantID}
		}
		return nil, fmt.Errorf("query tenant: %w", err)
	}
	return &t, nil
}

// CreateTenant creates a new tenant.
func (s *Service) CreateTenant(ctx context.Context, req CreateTenantRequest) (*domain.Tenant, error) {
	slug := strings.ToLower(strings.TrimSpace(req.Slug))

	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM tenants WHERE slug = $1)`, slug,
	).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("check slug: %w", err)
	}
	if exists {
		return nil, &domain.ErrConflict{Message: "slug already in use"}
	}

	now := time.Now().UTC()
	t := domain.Tenant{
		ID:        uuid.New(),
		Name:      strings.TrimSpace(req.Name),
		Slug:      slug,
		Country:   req.Country,
		Timezone:  req.Timezone,
		Plan:      req.Plan,
		Active:    true,
		Status:    domain.TenantStatusActive,
		CreatedAt: now,
		UpdatedAt: now,
	}

	_, err = s.pool.Exec(ctx,
		`INSERT INTO tenants (id, name, slug, country, timezone, plan, active, status, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		t.ID, t.Name, t.Slug, t.Country, t.Timezone, t.Plan, t.Active, t.Status, t.CreatedAt, t.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert tenant: %w", err)
	}

	log.Info().Str("tenant_id", t.ID.String()).Str("slug", t.Slug).Msg("tenant created")
	return &t, nil
}

// UpdateTenant updates a tenant's name, plan, or status.
func (s *Service) UpdateTenant(ctx context.Context, tenantID uuid.UUID, req UpdateTenantRequest) (*domain.Tenant, error) {
	setClauses := []string{"updated_at = @updatedAt"}
	args := pgx.NamedArgs{
		"id":        tenantID,
		"updatedAt": time.Now().UTC(),
	}

	if req.Name != nil {
		setClauses = append(setClauses, "name = @name")
		args["name"] = strings.TrimSpace(*req.Name)
	}
	if req.Plan != nil {
		setClauses = append(setClauses, "plan = @plan")
		args["plan"] = *req.Plan
	}
	if req.Status != nil {
		setClauses = append(setClauses, "status = @status")
		args["status"] = *req.Status
		// Keep active boolean in sync.
		active := *req.Status != domain.TenantStatusSuspended
		setClauses = append(setClauses, "active = @active")
		args["active"] = active
	}

	if len(setClauses) == 1 {
		return nil, &domain.ErrValidation{Field: "body", Message: "no fields to update"}
	}

	query := fmt.Sprintf(
		`UPDATE tenants SET %s
		 WHERE id = @id AND deleted_at IS NULL
		 RETURNING id, name, slug, country, timezone, plan, active, status, created_at, updated_at, deleted_at`,
		strings.Join(setClauses, ", "),
	)

	var t domain.Tenant
	err := s.pool.QueryRow(ctx, query, args).Scan(
		&t.ID, &t.Name, &t.Slug, &t.Country, &t.Timezone, &t.Plan, &t.Active, &t.Status,
		&t.CreatedAt, &t.UpdatedAt, &t.DeletedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrNotFound{Resource: "tenant", ID: tenantID}
		}
		return nil, fmt.Errorf("update tenant: %w", err)
	}

	// Invalidate tenant cache so suspended/updated tenants take effect immediately.
	middleware.InvalidateTenantCache(tenantID)

	log.Info().Str("tenant_id", t.ID.String()).Msg("tenant updated")
	return &t, nil
}

// DeleteTenant soft-deletes a tenant.
func (s *Service) DeleteTenant(ctx context.Context, tenantID uuid.UUID) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE tenants SET deleted_at = NOW(), active = false, status = 'suspended', updated_at = NOW()
		 WHERE id = $1 AND deleted_at IS NULL`,
		tenantID,
	)
	if err != nil {
		return fmt.Errorf("delete tenant: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return &domain.ErrNotFound{Resource: "tenant", ID: tenantID}
	}

	middleware.InvalidateTenantCache(tenantID)

	log.Info().Str("tenant_id", tenantID.String()).Msg("tenant soft-deleted")
	return nil
}

// InviteUser creates a user with a temp password in a tenant and sends a welcome email.
func (s *Service) InviteUser(ctx context.Context, invitedBy uuid.UUID, req InviteUserRequest) (*domain.User, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))

	// Check email uniqueness within tenant.
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id = $1 AND LOWER(email) = $2 AND deleted_at IS NULL)`,
		req.TenantID, email,
	).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("check email: %w", err)
	}
	if exists {
		return nil, &domain.ErrConflict{Message: "email already in use"}
	}

	// Get tenant name for the welcome email.
	var tenantName string
	err = s.pool.QueryRow(ctx,
		`SELECT name FROM tenants WHERE id = $1 AND deleted_at IS NULL`, req.TenantID,
	).Scan(&tenantName)
	if err != nil {
		return nil, &domain.ErrNotFound{Resource: "tenant", ID: req.TenantID}
	}

	// Generate temp password.
	tempPassword, err := generateTempPassword(12)
	if err != nil {
		return nil, fmt.Errorf("generate temp password: %w", err)
	}

	hash, err := auth.HashPassword(tempPassword)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	now := time.Now().UTC()
	userID := uuid.New()

	// Create user with password_change_required = true.
	_, err = s.pool.Exec(ctx,
		`INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, totp_enabled, password_change_required, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, false, true, $8, $9)`,
		userID, req.TenantID, email, hash,
		strings.TrimSpace(req.FirstName), strings.TrimSpace(req.LastName),
		req.Role, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("insert user: %w", err)
	}

	// Record invitation.
	_, err = s.pool.Exec(ctx,
		`INSERT INTO invitations (tenant_id, email, role, invited_by, temp_password_hash, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		req.TenantID, email, req.Role, invitedBy, hash, now,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to record invitation — user was created")
	}

	// Send welcome email (async, don't block).
	go func() {
		if mailErr := s.mailer.SendWelcome(email, req.FirstName, tenantName, tempPassword); mailErr != nil {
			log.Error().Err(mailErr).Str("email", email).Msg("failed to send welcome email")
		}
	}()

	user := &domain.User{
		ID:                     userID,
		TenantID:               &req.TenantID,
		Email:                  email,
		FirstName:              strings.TrimSpace(req.FirstName),
		LastName:               strings.TrimSpace(req.LastName),
		Role:                   req.Role,
		PasswordChangeRequired: true,
		CreatedAt:              now,
		UpdatedAt:              now,
	}

	log.Info().
		Str("user_id", userID.String()).
		Str("email", email).
		Str("tenant_id", req.TenantID.String()).
		Msg("user invited")

	return user, nil
}

// DashboardStats returns global statistics for the superadmin dashboard.
type DashboardStats struct {
	TotalTenants  int `json:"total_tenants"`
	ActiveTenants int `json:"active_tenants"`
	TotalUsers    int `json:"total_users"`
	TotalVehicles int `json:"total_vehicles"`
}

func (s *Service) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	var stats DashboardStats
	err := s.pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM tenants WHERE deleted_at IS NULL),
			(SELECT COUNT(*) FROM tenants WHERE deleted_at IS NULL AND status = 'active'),
			(SELECT COUNT(*) FROM users WHERE deleted_at IS NULL),
			(SELECT COUNT(*) FROM vehicles WHERE deleted_at IS NULL)
	`).Scan(&stats.TotalTenants, &stats.ActiveTenants, &stats.TotalUsers, &stats.TotalVehicles)
	if err != nil {
		return nil, fmt.Errorf("query dashboard stats: %w", err)
	}
	return &stats, nil
}

// generateTempPassword creates a random password that meets complexity requirements.
func generateTempPassword(length int) (string, error) {
	const (
		upper   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
		lower   = "abcdefghijklmnopqrstuvwxyz"
		digits  = "0123456789"
		special = "!@#$%&*"
	)
	all := upper + lower + digits + special

	pw := make([]byte, length)

	// Ensure at least one of each category.
	charsets := []string{upper, lower, digits, special}
	for i, cs := range charsets {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(cs))))
		if err != nil {
			return "", err
		}
		pw[i] = cs[idx.Int64()]
	}

	// Fill the rest randomly.
	for i := len(charsets); i < length; i++ {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(all))))
		if err != nil {
			return "", err
		}
		pw[i] = all[idx.Int64()]
	}

	// Shuffle.
	for i := length - 1; i > 0; i-- {
		j, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return "", err
		}
		pw[i], pw[j.Int64()] = pw[j.Int64()], pw[i]
	}

	return string(pw), nil
}
