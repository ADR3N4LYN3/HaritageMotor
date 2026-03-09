package user

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/chriis/heritage-motor/internal/auth"
	"github.com/chriis/heritage-motor/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type CreateUserRequest struct {
	Email     string `json:"email" validate:"required,email"`
	Password  string `json:"password" validate:"required,min=8"`
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
	Role      string `json:"role" validate:"required,oneof=admin operator technician viewer"`
}

type UpdateUserRequest struct {
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	Role      *string `json:"role" validate:"omitempty,oneof=admin operator technician viewer"`
}

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func (s *Service) List(ctx context.Context, tenantID uuid.UUID) ([]domain.User, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, tenant_id, email, password_hash, first_name, last_name, role, totp_secret, totp_enabled, last_login_at, created_at, updated_at, deleted_at
		 FROM users
		 WHERE tenant_id = $1 AND deleted_at IS NULL
		 ORDER BY created_at ASC`,
		tenantID,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to query users")
		return nil, fmt.Errorf("query users: %w", err)
	}
	defer rows.Close()

	users := make([]domain.User, 0)
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(
			&u.ID, &u.TenantID, &u.Email, &u.PasswordHash,
			&u.FirstName, &u.LastName, &u.Role,
			&u.TOTPSecret, &u.TOTPEnabled, &u.LastLoginAt,
			&u.CreatedAt, &u.UpdatedAt, &u.DeletedAt,
		); err != nil {
			log.Error().Err(err).Msg("failed to scan user row")
			return nil, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		log.Error().Err(err).Msg("error iterating user rows")
		return nil, fmt.Errorf("iterate users: %w", err)
	}

	return users, nil
}

// validatePasswordStrength enforces password complexity rules:
// min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character.
func validatePasswordStrength(password string) error {
	if len(password) < 8 {
		return &domain.ErrValidation{Field: "password", Message: "password must be at least 8 characters"}
	}
	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r):
			hasSpecial = true
		}
	}
	if !hasUpper {
		return &domain.ErrValidation{Field: "password", Message: "password must contain at least one uppercase letter"}
	}
	if !hasLower {
		return &domain.ErrValidation{Field: "password", Message: "password must contain at least one lowercase letter"}
	}
	if !hasDigit {
		return &domain.ErrValidation{Field: "password", Message: "password must contain at least one digit"}
	}
	if !hasSpecial {
		return &domain.ErrValidation{Field: "password", Message: "password must contain at least one special character"}
	}
	return nil
}

func (s *Service) Create(ctx context.Context, tenantID uuid.UUID, req CreateUserRequest) (*domain.User, error) {
	// Validate password strength
	if err := validatePasswordStrength(req.Password); err != nil {
		return nil, err
	}

	// Check email uniqueness within tenant
	email := strings.ToLower(strings.TrimSpace(req.Email))
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id = $1 AND LOWER(email) = $2 AND deleted_at IS NULL)`,
		tenantID, email,
	).Scan(&exists)
	if err != nil {
		log.Error().Err(err).Msg("failed to check email uniqueness")
		return nil, fmt.Errorf("check email: %w", err)
	}
	if exists {
		return nil, &domain.ErrConflict{Message: "email already in use"}
	}

	// Hash password
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		log.Error().Err(err).Msg("failed to hash password")
		return nil, fmt.Errorf("hash password: %w", err)
	}

	now := time.Now().UTC()
	u := domain.User{
		ID:           uuid.New(),
		TenantID:     tenantID,
		Email:        email,
		PasswordHash: hash,
		FirstName:    strings.TrimSpace(req.FirstName),
		LastName:     strings.TrimSpace(req.LastName),
		Role:         req.Role,
		TOTPEnabled:  false,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	_, err = s.pool.Exec(ctx,
		`INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, totp_enabled, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		u.ID, u.TenantID, u.Email, u.PasswordHash,
		u.FirstName, u.LastName, u.Role,
		u.TOTPEnabled, u.CreatedAt, u.UpdatedAt,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to insert user")
		return nil, fmt.Errorf("insert user: %w", err)
	}

	log.Info().
		Str("user_id", u.ID.String()).
		Str("email", u.Email).
		Str("role", u.Role).
		Msg("user created")

	return &u, nil
}

func (s *Service) Update(ctx context.Context, tenantID, userID uuid.UUID, req UpdateUserRequest) (*domain.User, error) {
	// Build dynamic SET clause
	setClauses := []string{"updated_at = @updatedAt"}
	args := pgx.NamedArgs{
		"id":        userID,
		"tenantID":  tenantID,
		"updatedAt": time.Now().UTC(),
	}

	if req.FirstName != nil {
		setClauses = append(setClauses, "first_name = @firstName")
		args["firstName"] = strings.TrimSpace(*req.FirstName)
	}
	if req.LastName != nil {
		setClauses = append(setClauses, "last_name = @lastName")
		args["lastName"] = strings.TrimSpace(*req.LastName)
	}
	if req.Role != nil {
		setClauses = append(setClauses, "role = @role")
		args["role"] = *req.Role
	}

	if len(setClauses) == 1 {
		// Only updated_at, nothing to change
		return nil, &domain.ErrValidation{Field: "body", Message: "no fields to update"}
	}

	query := fmt.Sprintf(
		`UPDATE users SET %s
		 WHERE id = @id AND tenant_id = @tenantID AND deleted_at IS NULL
		 RETURNING id, tenant_id, email, password_hash, first_name, last_name, role, totp_secret, totp_enabled, last_login_at, created_at, updated_at, deleted_at`,
		strings.Join(setClauses, ", "),
	)

	var u domain.User
	err := s.pool.QueryRow(ctx, query, args).Scan(
		&u.ID, &u.TenantID, &u.Email, &u.PasswordHash,
		&u.FirstName, &u.LastName, &u.Role,
		&u.TOTPSecret, &u.TOTPEnabled, &u.LastLoginAt,
		&u.CreatedAt, &u.UpdatedAt, &u.DeletedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrNotFound{Resource: "user", ID: userID}
		}
		log.Error().Err(err).Str("user_id", userID.String()).Msg("failed to update user")
		return nil, fmt.Errorf("update user: %w", err)
	}

	log.Info().
		Str("user_id", u.ID.String()).
		Msg("user updated")

	return &u, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, userID uuid.UUID) error {
	result, err := s.pool.Exec(ctx,
		`UPDATE users SET deleted_at = NOW(), updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
		userID, tenantID,
	)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID.String()).Msg("failed to soft-delete user")
		return fmt.Errorf("delete user: %w", err)
	}

	if result.RowsAffected() == 0 {
		return &domain.ErrNotFound{Resource: "user", ID: userID}
	}

	log.Info().
		Str("user_id", userID.String()).
		Msg("user soft-deleted")

	return nil
}
