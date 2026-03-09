package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/chriis/heritage-motor/internal/auth"
	"github.com/chriis/heritage-motor/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// LoginResult is returned on successful authentication when MFA is not required.
type LoginResult struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	User         *domain.User `json:"user"`
}

// MFAPendingResult is returned when the user has TOTP enabled and must verify.
type MFAPendingResult struct {
	MFAToken string `json:"mfa_token"`
}

// MFASetupResult contains the TOTP provisioning details for the authenticator app.
type MFASetupResult struct {
	Secret string `json:"secret"`
	URL    string `json:"url"`
}

// Service handles all authentication and MFA operations.
type Service struct {
	pool *pgxpool.Pool
	jwt  *auth.JWTManager
}

// NewService creates a new auth service.
func NewService(pool *pgxpool.Pool, jwtManager *auth.JWTManager) *Service {
	return &Service{
		pool: pool,
		jwt:  jwtManager,
	}
}

// Login authenticates a user by email and password.
// If the user has TOTP enabled, an MFA pending token is returned instead of
// full JWT tokens. The caller must then call VerifyMFA to complete login.
// Queries without RLS context because the tenant is unknown at login time.
func (s *Service) Login(ctx context.Context, email, password string) (*LoginResult, *MFAPendingResult, error) {
	var user domain.User
	err := s.pool.QueryRow(ctx,
		`SELECT id, tenant_id, email, password_hash, first_name, last_name,
		        role, totp_secret, totp_enabled, last_login_at,
		        created_at, updated_at, deleted_at
		 FROM users
		 WHERE email = $1 AND deleted_at IS NULL`,
		email,
	).Scan(
		&user.ID, &user.TenantID, &user.Email, &user.PasswordHash,
		&user.FirstName, &user.LastName, &user.Role,
		&user.TOTPSecret, &user.TOTPEnabled, &user.LastLoginAt,
		&user.CreatedAt, &user.UpdatedAt, &user.DeletedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil, &domain.ErrUnauthorized{Message: "invalid credentials"}
		}
		return nil, nil, fmt.Errorf("query user: %w", err)
	}

	// Verify the tenant is active.
	var tenantActive bool
	err = s.pool.QueryRow(ctx,
		`SELECT active FROM tenants WHERE id = $1 AND deleted_at IS NULL`,
		user.TenantID,
	).Scan(&tenantActive)
	if err != nil || !tenantActive {
		return nil, nil, &domain.ErrUnauthorized{Message: "tenant inactive"}
	}

	if !auth.CheckPassword(password, user.PasswordHash) {
		return nil, nil, &domain.ErrUnauthorized{Message: "invalid credentials"}
	}

	// If TOTP is enabled, return an MFA pending token.
	if user.TOTPEnabled {
		mfaToken, err := s.jwt.GenerateMFAPendingToken(user.ID, user.TenantID)
		if err != nil {
			return nil, nil, fmt.Errorf("generate mfa token: %w", err)
		}
		return nil, &MFAPendingResult{MFAToken: mfaToken}, nil
	}

	// Issue full tokens.
	result, err := s.issueTokens(ctx, &user)
	if err != nil {
		return nil, nil, err
	}

	return result, nil, nil
}

// VerifyMFA completes login for users with TOTP enabled.
func (s *Service) VerifyMFA(ctx context.Context, mfaPendingToken, code string) (*LoginResult, error) {
	claims, err := s.jwt.ValidateMFAPendingToken(mfaPendingToken)
	if err != nil {
		return nil, &domain.ErrUnauthorized{Message: "invalid or expired mfa token"}
	}

	var user domain.User
	err = s.pool.QueryRow(ctx,
		`SELECT id, tenant_id, email, password_hash, first_name, last_name,
		        role, totp_secret, totp_enabled, last_login_at,
		        created_at, updated_at, deleted_at
		 FROM users
		 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
		claims.UserID, claims.TenantID,
	).Scan(
		&user.ID, &user.TenantID, &user.Email, &user.PasswordHash,
		&user.FirstName, &user.LastName, &user.Role,
		&user.TOTPSecret, &user.TOTPEnabled, &user.LastLoginAt,
		&user.CreatedAt, &user.UpdatedAt, &user.DeletedAt,
	)
	if err != nil {
		return nil, &domain.ErrUnauthorized{Message: "user not found"}
	}

	if user.TOTPSecret == nil || !user.TOTPEnabled {
		return nil, &domain.ErrUnauthorized{Message: "mfa not enabled"}
	}

	if !auth.ValidateTOTPCode(*user.TOTPSecret, code) {
		return nil, &domain.ErrUnauthorized{Message: "invalid mfa code"}
	}

	return s.issueTokens(ctx, &user)
}

// RefreshToken rotates a refresh token and returns a new access token.
func (s *Service) RefreshToken(ctx context.Context, refreshToken string) (*LoginResult, error) {
	tokenHash := hashToken(refreshToken)

	var tokenID, userID, tenantID uuid.UUID
	var expiresAt time.Time
	var revokedAt *time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT id, user_id, tenant_id, expires_at, revoked_at
		 FROM refresh_tokens
		 WHERE token_hash = $1`,
		tokenHash,
	).Scan(&tokenID, &userID, &tenantID, &expiresAt, &revokedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrUnauthorized{Message: "invalid refresh token"}
		}
		return nil, fmt.Errorf("query refresh token: %w", err)
	}

	if revokedAt != nil {
		return nil, &domain.ErrUnauthorized{Message: "refresh token revoked"}
	}
	if time.Now().After(expiresAt) {
		return nil, &domain.ErrUnauthorized{Message: "refresh token expired"}
	}

	// Revoke the old token.
	_, err = s.pool.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
		tokenID,
	)
	if err != nil {
		return nil, fmt.Errorf("revoke old refresh token: %w", err)
	}

	// Fetch user for the new access token claims.
	var user domain.User
	err = s.pool.QueryRow(ctx,
		`SELECT id, tenant_id, email, password_hash, first_name, last_name,
		        role, totp_secret, totp_enabled, last_login_at,
		        created_at, updated_at, deleted_at
		 FROM users
		 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
		userID, tenantID,
	).Scan(
		&user.ID, &user.TenantID, &user.Email, &user.PasswordHash,
		&user.FirstName, &user.LastName, &user.Role,
		&user.TOTPSecret, &user.TOTPEnabled, &user.LastLoginAt,
		&user.CreatedAt, &user.UpdatedAt, &user.DeletedAt,
	)
	if err != nil {
		return nil, &domain.ErrUnauthorized{Message: "user not found"}
	}

	return s.issueTokens(ctx, &user)
}

// Logout revokes a refresh token.
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	tokenHash := hashToken(refreshToken)

	tag, err := s.pool.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = NOW()
		 WHERE token_hash = $1 AND revoked_at IS NULL`,
		tokenHash,
	)
	if err != nil {
		return fmt.Errorf("revoke refresh token: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return &domain.ErrUnauthorized{Message: "invalid refresh token"}
	}

	return nil
}

// GetMe returns the current user profile.
func (s *Service) GetMe(ctx context.Context, userID, tenantID uuid.UUID) (*domain.User, error) {
	var user domain.User
	err := s.pool.QueryRow(ctx,
		`SELECT id, tenant_id, email, password_hash, first_name, last_name,
		        role, totp_secret, totp_enabled, last_login_at,
		        created_at, updated_at, deleted_at
		 FROM users
		 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
		userID, tenantID,
	).Scan(
		&user.ID, &user.TenantID, &user.Email, &user.PasswordHash,
		&user.FirstName, &user.LastName, &user.Role,
		&user.TOTPSecret, &user.TOTPEnabled, &user.LastLoginAt,
		&user.CreatedAt, &user.UpdatedAt, &user.DeletedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrNotFound{Resource: "user", ID: userID}
		}
		return nil, fmt.Errorf("query user: %w", err)
	}

	return &user, nil
}

// SetupMFA generates a new TOTP secret for the user.
// The secret is stored but TOTP is not enabled until EnableMFA is called.
func (s *Service) SetupMFA(ctx context.Context, userID, tenantID uuid.UUID) (*MFASetupResult, error) {
	// Fetch user email for the TOTP issuer label.
	var email string
	var totpEnabled bool
	err := s.pool.QueryRow(ctx,
		`SELECT email, totp_enabled FROM users
		 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
		userID, tenantID,
	).Scan(&email, &totpEnabled)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrNotFound{Resource: "user", ID: userID}
		}
		return nil, fmt.Errorf("query user: %w", err)
	}

	if totpEnabled {
		return nil, &domain.ErrConflict{Message: "mfa already enabled"}
	}

	key, err := auth.GenerateTOTPSecret(email)
	if err != nil {
		return nil, fmt.Errorf("generate totp secret: %w", err)
	}

	// Store the secret but do not enable TOTP yet.
	_, err = s.pool.Exec(ctx,
		`UPDATE users SET totp_secret = $1, updated_at = NOW()
		 WHERE id = $2 AND tenant_id = $3`,
		key.Secret(), userID, tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("store totp secret: %w", err)
	}

	return &MFASetupResult{
		Secret: key.Secret(),
		URL:    key.URL(),
	}, nil
}

// EnableMFA confirms TOTP activation by verifying a code from the authenticator app.
func (s *Service) EnableMFA(ctx context.Context, userID, tenantID uuid.UUID, code string) error {
	var secret *string
	var totpEnabled bool
	err := s.pool.QueryRow(ctx,
		`SELECT totp_secret, totp_enabled FROM users
		 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
		userID, tenantID,
	).Scan(&secret, &totpEnabled)
	if err != nil {
		if err == pgx.ErrNoRows {
			return &domain.ErrNotFound{Resource: "user", ID: userID}
		}
		return fmt.Errorf("query user: %w", err)
	}

	if totpEnabled {
		return &domain.ErrConflict{Message: "mfa already enabled"}
	}
	if secret == nil {
		return &domain.ErrValidation{Field: "totp", Message: "must call setup first"}
	}

	if !auth.ValidateTOTPCode(*secret, code) {
		return &domain.ErrUnauthorized{Message: "invalid mfa code"}
	}

	_, err = s.pool.Exec(ctx,
		`UPDATE users SET totp_enabled = true, updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2`,
		userID, tenantID,
	)
	if err != nil {
		return fmt.Errorf("enable totp: %w", err)
	}

	return nil
}

// DisableMFA turns off TOTP for a user and clears the stored secret.
func (s *Service) DisableMFA(ctx context.Context, userID, tenantID uuid.UUID) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE users SET totp_enabled = false, totp_secret = NULL, updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
		userID, tenantID,
	)
	if err != nil {
		return fmt.Errorf("disable totp: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return &domain.ErrNotFound{Resource: "user", ID: userID}
	}

	return nil
}

// issueTokens generates an access token and a refresh token, persists the
// refresh token hash, and updates the user's last_login_at timestamp.
func (s *Service) issueTokens(ctx context.Context, user *domain.User) (*LoginResult, error) {
	accessToken, err := s.jwt.GenerateAccessToken(user.ID, user.TenantID, user.Role)
	if err != nil {
		return nil, fmt.Errorf("generate access token: %w", err)
	}

	rawRefresh, err := generateRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	tokenHash := hashToken(rawRefresh)
	expiresAt := time.Now().Add(s.jwt.RefreshExpiry())

	_, err = s.pool.Exec(ctx,
		`INSERT INTO refresh_tokens (id, user_id, tenant_id, token_hash, expires_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, NOW())`,
		uuid.New(), user.ID, user.TenantID, tokenHash, expiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("store refresh token: %w", err)
	}

	// Update last_login_at in the background.
	userIDCopy := user.ID
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Error().Interface("panic", r).Str("user_id", userIDCopy.String()).Msg("panic in last_login_at goroutine")
			}
		}()
		bgCtx, bgCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer bgCancel()
		_, dbErr := s.pool.Exec(bgCtx,
			`UPDATE users SET last_login_at = NOW() WHERE id = $1`,
			userIDCopy,
		)
		if dbErr != nil {
			log.Error().Err(dbErr).Str("user_id", userIDCopy.String()).Msg("failed to update last_login_at")
		}
	}()

	return &LoginResult{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
		User:         user,
	}, nil
}

// generateRefreshToken creates a cryptographically random 32-byte token
// encoded as a hex string.
func generateRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("crypto/rand: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// hashToken returns the SHA-256 hex digest of a raw token string.
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
