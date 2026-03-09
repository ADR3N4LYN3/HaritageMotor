package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/chriis/heritage-motor/internal/auth"
	"github.com/chriis/heritage-motor/internal/db"
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

// userColumns is the standard SELECT list for scanning into domain.User.
const userColumns = `id, tenant_id, email, password_hash, first_name, last_name,
	role, totp_secret, totp_enabled, password_change_required, last_login_at,
	created_at, updated_at, deleted_at`

func scanUser(row pgx.Row) (domain.User, error) {
	var u domain.User
	err := row.Scan(
		&u.ID, &u.TenantID, &u.Email, &u.PasswordHash,
		&u.FirstName, &u.LastName, &u.Role,
		&u.TOTPSecret, &u.TOTPEnabled, &u.PasswordChangeRequired, &u.LastLoginAt,
		&u.CreatedAt, &u.UpdatedAt, &u.DeletedAt,
	)
	return u, err
}

// tenantIDOrNil returns the UUID value or uuid.Nil if the pointer is nil (superadmin).
func tenantIDOrNil(tid *uuid.UUID) uuid.UUID {
	if tid != nil {
		return *tid
	}
	return uuid.Nil
}

// Login authenticates a user by email and password.
func (s *Service) Login(ctx context.Context, email, password string) (*LoginResult, *MFAPendingResult, error) {
	user, err := scanUser(db.Conn(ctx, s.pool).QueryRow(ctx,
		`SELECT `+userColumns+`
		 FROM users u
		 WHERE u.email = $1 AND u.deleted_at IS NULL
		   AND (u.role = 'superadmin' OR EXISTS (
		     SELECT 1 FROM tenants t WHERE t.id = u.tenant_id AND t.deleted_at IS NULL
		   ))`,
		email,
	))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil, &domain.ErrUnauthorized{Message: "invalid credentials"}
		}
		return nil, nil, fmt.Errorf("query user: %w", err)
	}

	// Superadmin has no tenant — skip tenant check.
	if user.Role != domain.RoleSuperAdmin {
		tenantID := tenantIDOrNil(user.TenantID)
		var tenantStatus string
		err = db.Conn(ctx, s.pool).QueryRow(ctx,
			`SELECT status FROM tenants WHERE id = $1 AND deleted_at IS NULL`,
			tenantID,
		).Scan(&tenantStatus)
		if err != nil {
			return nil, nil, &domain.ErrUnauthorized{Message: "tenant not found"}
		}
		if tenantStatus == domain.TenantStatusSuspended {
			return nil, nil, &domain.ErrTenantSuspended{}
		}
	}

	if !auth.CheckPassword(password, user.PasswordHash) {
		return nil, nil, &domain.ErrUnauthorized{Message: "invalid credentials"}
	}

	// If TOTP is enabled, return an MFA pending token.
	if user.TOTPEnabled {
		mfaToken, err := s.jwt.GenerateMFAPendingToken(user.ID, tenantIDOrNil(user.TenantID))
		if err != nil {
			return nil, nil, fmt.Errorf("generate mfa token: %w", err)
		}
		return nil, &MFAPendingResult{MFAToken: mfaToken}, nil
	}

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

	user, err := scanUser(db.Conn(ctx, s.pool).QueryRow(ctx,
		`SELECT `+userColumns+`
		 FROM users
		 WHERE id = $1 AND deleted_at IS NULL`,
		claims.UserID,
	))
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

	var tokenID, userID uuid.UUID
	var tenantID *uuid.UUID
	var expiresAt time.Time
	var revokedAt *time.Time
	err := db.Conn(ctx, s.pool).QueryRow(ctx,
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
	_, err = db.Conn(ctx, s.pool).Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
		tokenID,
	)
	if err != nil {
		return nil, fmt.Errorf("revoke old refresh token: %w", err)
	}

	// Fetch user for the new access token claims.
	user, err := scanUser(db.Conn(ctx, s.pool).QueryRow(ctx,
		`SELECT `+userColumns+`
		 FROM users
		 WHERE id = $1 AND deleted_at IS NULL`,
		userID,
	))
	if err != nil {
		return nil, &domain.ErrUnauthorized{Message: "user not found"}
	}

	return s.issueTokens(ctx, &user)
}

// Logout revokes a refresh token and blacklists the current access token.
func (s *Service) Logout(ctx context.Context, refreshToken, accessJTI string, accessExpiresAt time.Time) error {
	tokenHash := hashToken(refreshToken)

	tag, err := db.Conn(ctx, s.pool).Exec(ctx,
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

	// Blacklist the current access token so it cannot be reused after logout.
	if accessJTI != "" && !accessExpiresAt.IsZero() {
		_, blErr := s.pool.Exec(ctx,
			`INSERT INTO token_blacklist (jti, expires_at) VALUES ($1, $2)`,
			accessJTI, accessExpiresAt,
		)
		if blErr != nil {
			log.Error().Err(blErr).Str("jti", accessJTI).Msg("failed to blacklist access token on logout")
		}
	}

	return nil
}

// GetMe returns the current user profile.
func (s *Service) GetMe(ctx context.Context, userID, tenantID uuid.UUID) (*domain.User, error) {
	user, err := scanUser(db.Conn(ctx, s.pool).QueryRow(ctx,
		`SELECT `+userColumns+`
		 FROM users
		 WHERE id = $1 AND deleted_at IS NULL`,
		userID,
	))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrNotFound{Resource: "user", ID: userID}
		}
		return nil, fmt.Errorf("query user: %w", err)
	}

	return &user, nil
}

// ChangePassword changes a user's password and clears the password_change_required flag.
func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error {
	var passwordHash string
	err := db.Conn(ctx, s.pool).QueryRow(ctx,
		`SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL`,
		userID,
	).Scan(&passwordHash)
	if err != nil {
		if err == pgx.ErrNoRows {
			return &domain.ErrNotFound{Resource: "user", ID: userID}
		}
		return fmt.Errorf("query user: %w", err)
	}

	if !auth.CheckPassword(currentPassword, passwordHash) {
		return &domain.ErrUnauthorized{Message: "invalid current password"}
	}

	if err := domain.ValidatePasswordStrength(newPassword); err != nil {
		return err
	}

	hash, err := auth.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	_, err = db.Conn(ctx, s.pool).Exec(ctx,
		`UPDATE users SET password_hash = $1, password_change_required = false, updated_at = NOW()
		 WHERE id = $2`,
		hash, userID,
	)
	if err != nil {
		return fmt.Errorf("update password: %w", err)
	}

	return nil
}

// SetupMFA generates a new TOTP secret for the user.
func (s *Service) SetupMFA(ctx context.Context, userID, tenantID uuid.UUID) (*MFASetupResult, error) {
	var email string
	var totpEnabled bool
	err := db.Conn(ctx, s.pool).QueryRow(ctx,
		`SELECT email, totp_enabled FROM users
		 WHERE id = $1 AND deleted_at IS NULL`,
		userID,
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

	_, err = db.Conn(ctx, s.pool).Exec(ctx,
		`UPDATE users SET totp_secret = $1, updated_at = NOW()
		 WHERE id = $2`,
		key.Secret(), userID,
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
	err := db.Conn(ctx, s.pool).QueryRow(ctx,
		`SELECT totp_secret, totp_enabled FROM users
		 WHERE id = $1 AND deleted_at IS NULL`,
		userID,
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

	_, err = db.Conn(ctx, s.pool).Exec(ctx,
		`UPDATE users SET totp_enabled = true, updated_at = NOW()
		 WHERE id = $1`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("enable totp: %w", err)
	}

	return nil
}

// DisableMFA turns off TOTP for a user and clears the stored secret.
func (s *Service) DisableMFA(ctx context.Context, userID, tenantID uuid.UUID) error {
	tag, err := db.Conn(ctx, s.pool).Exec(ctx,
		`UPDATE users SET totp_enabled = false, totp_secret = NULL, updated_at = NOW()
		 WHERE id = $1 AND deleted_at IS NULL`,
		userID,
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
	tid := tenantIDOrNil(user.TenantID)
	accessToken, err := s.jwt.GenerateAccessToken(user.ID, tid, user.Role, user.PasswordChangeRequired)
	if err != nil {
		return nil, fmt.Errorf("generate access token: %w", err)
	}

	rawRefresh, err := generateRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	tokenHash := hashToken(rawRefresh)
	expiresAt := time.Now().Add(s.jwt.RefreshExpiry())

	_, err = db.Conn(ctx, s.pool).Exec(ctx,
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
		_, dbErr := db.Conn(bgCtx, s.pool).Exec(bgCtx,
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
