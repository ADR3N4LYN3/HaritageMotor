package auth

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

func TestGenerateAccessToken_ValidToken(t *testing.T) {
	mgr := NewJWTManager("test-secret-key", 15*time.Minute, 7*24*time.Hour)
	userID := uuid.New()
	tenantID := uuid.New()

	token, err := mgr.GenerateAccessToken(userID, tenantID, "admin", false)
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	// Token should have 3 dot-separated parts (JWT format)
	parts := strings.Split(token, ".")
	assert.Len(t, parts, 3)
}

func TestGenerateAccessToken_CorrectClaims(t *testing.T) {
	mgr := NewJWTManager("test-secret-key", 15*time.Minute, 7*24*time.Hour)
	userID := uuid.New()
	tenantID := uuid.New()

	token, err := mgr.GenerateAccessToken(userID, tenantID, "operator", true)
	require.NoError(t, err)

	claims, err := mgr.ValidateAccessToken(token)
	require.NoError(t, err)

	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, tenantID, claims.TenantID)
	assert.Equal(t, "operator", claims.Role)
	assert.True(t, claims.PasswordChangeRequired)
	assert.Equal(t, "heritagemotor.app", claims.Issuer)
	assert.NotEmpty(t, claims.ID) // jti
}

func TestValidateAccessToken_Valid(t *testing.T) {
	mgr := NewJWTManager("test-secret-key", 15*time.Minute, 7*24*time.Hour)
	userID := uuid.New()
	tenantID := uuid.New()

	token, err := mgr.GenerateAccessToken(userID, tenantID, "viewer", false)
	require.NoError(t, err)

	claims, err := mgr.ValidateAccessToken(token)
	require.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, "viewer", claims.Role)
}

func TestValidateAccessToken_Expired(t *testing.T) {
	// Create manager with negative expiry to produce an already-expired token
	mgr := NewJWTManager("test-secret-key", -1*time.Second, 7*24*time.Hour)
	userID := uuid.New()
	tenantID := uuid.New()

	token, err := mgr.GenerateAccessToken(userID, tenantID, "admin", false)
	require.NoError(t, err)

	_, err = mgr.ValidateAccessToken(token)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "token")
}

func TestValidateAccessToken_WrongSecret(t *testing.T) {
	mgr1 := NewJWTManager("secret-one", 15*time.Minute, 7*24*time.Hour)
	mgr2 := NewJWTManager("secret-two", 15*time.Minute, 7*24*time.Hour)

	token, err := mgr1.GenerateAccessToken(uuid.New(), uuid.New(), "admin", false)
	require.NoError(t, err)

	_, err = mgr2.ValidateAccessToken(token)
	assert.Error(t, err)
}

func TestGenerateMFAPendingToken_Valid(t *testing.T) {
	mgr := NewJWTManager("test-secret-key", 15*time.Minute, 7*24*time.Hour)
	userID := uuid.New()
	tenantID := uuid.New()

	token, err := mgr.GenerateMFAPendingToken(userID, tenantID)
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	claims, err := mgr.ValidateMFAPendingToken(token)
	require.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, tenantID, claims.TenantID)
	assert.True(t, claims.Pending)
}

func TestAccessExpiry(t *testing.T) {
	mgr := NewJWTManager("s", 15*time.Minute, 7*24*time.Hour)
	assert.Equal(t, 15*time.Minute, mgr.AccessExpiry())
}

func TestRefreshExpiry(t *testing.T) {
	mgr := NewJWTManager("s", 15*time.Minute, 7*24*time.Hour)
	assert.Equal(t, 7*24*time.Hour, mgr.RefreshExpiry())
}

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

func TestHashPassword_BcryptCost12(t *testing.T) {
	hash, err := HashPassword("MyP@ssw0rd!")
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(hash, "$2a$12$"), "hash should use bcrypt cost 12, got: %s", hash)
}

func TestCheckPassword_Correct(t *testing.T) {
	hash, err := HashPassword("Str0ng!Pass")
	require.NoError(t, err)
	assert.True(t, CheckPassword("Str0ng!Pass", hash))
}

func TestCheckPassword_Wrong(t *testing.T) {
	hash, err := HashPassword("Str0ng!Pass")
	require.NoError(t, err)
	assert.False(t, CheckPassword("WrongPassword", hash))
}

func TestCheckPassword_EmptyPassword(t *testing.T) {
	hash, err := HashPassword("SomeP@ss1")
	require.NoError(t, err)
	assert.False(t, CheckPassword("", hash))
}

// ---------------------------------------------------------------------------
// TOTP
// ---------------------------------------------------------------------------

func TestGenerateTOTPSecret_NonEmpty(t *testing.T) {
	key, err := GenerateTOTPSecret("user@example.com")
	require.NoError(t, err)
	assert.NotEmpty(t, key.Secret())
	assert.Contains(t, key.URL(), "Heritage")
	assert.Contains(t, key.URL(), "user@example.com")
}

func TestValidateTOTPCode_Valid(t *testing.T) {
	key, err := GenerateTOTPSecret("test@example.com")
	require.NoError(t, err)

	// Generate a valid code for the current time
	code, err := totp.GenerateCode(key.Secret(), time.Now())
	require.NoError(t, err)

	assert.True(t, ValidateTOTPCode(key.Secret(), code))
}

func TestValidateTOTPCode_Invalid(t *testing.T) {
	key, err := GenerateTOTPSecret("test@example.com")
	require.NoError(t, err)

	assert.False(t, ValidateTOTPCode(key.Secret(), "000000"))
}

func TestValidateTOTPCode_WrongSecret(t *testing.T) {
	key1, err := GenerateTOTPSecret("a@example.com")
	require.NoError(t, err)
	key2, err := GenerateTOTPSecret("b@example.com")
	require.NoError(t, err)

	code, err := totp.GenerateCode(key1.Secret(), time.Now())
	require.NoError(t, err)

	// Code from key1 should not validate against key2's secret
	assert.False(t, ValidateTOTPCode(key2.Secret(), code))
}
