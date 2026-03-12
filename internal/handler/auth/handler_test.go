package auth_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/chriis/heritage-motor/internal/testutil"
)

const (
	testPassword = "Str0ng!Pass#99"
	weakPassword = "weak"
)

// ---------- Login ----------

func TestLogin_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "login-ok", "starter")
	env.CreateUser(t, tenantID, "login-ok@test.com", testPassword, "admin")

	resp := env.DoRequest(t, http.MethodPost, "/auth/login", "", map[string]string{
		"email":    "login-ok@test.com",
		"password": testPassword,
	})
	defer resp.Body.Close()

	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	testutil.ReadJSON(t, resp, &body)

	assert.NotEmpty(t, body["access_token"], "access_token should be present")
	assert.NotEmpty(t, body["refresh_token"], "refresh_token should be present")
	assert.NotNil(t, body["user"], "user should be present")

	user, ok := body["user"].(map[string]interface{})
	require.True(t, ok, "user should be a JSON object")
	assert.Equal(t, "login-ok@test.com", user["email"])
}

func TestLogin_WrongPassword(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "login-badpw", "starter")
	env.CreateUser(t, tenantID, "login-badpw@test.com", testPassword, "admin")

	resp := env.DoRequest(t, http.MethodPost, "/auth/login", "", map[string]string{
		"email":    "login-badpw@test.com",
		"password": "WrongPassword!1",
	})
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestLogin_UnknownEmail(t *testing.T) {
	env := testutil.Setup(t)

	resp := env.DoRequest(t, http.MethodPost, "/auth/login", "", map[string]string{
		"email":    "nobody@test.com",
		"password": testPassword,
	})
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

// ---------- Refresh ----------

func TestRefresh_ValidToken(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "refresh-ok", "starter")
	env.CreateUser(t, tenantID, "refresh-ok@test.com", testPassword, "admin")

	// Login to obtain a refresh token.
	loginResp := env.DoRequest(t, http.MethodPost, "/auth/login", "", map[string]string{
		"email":    "refresh-ok@test.com",
		"password": testPassword,
	})
	defer loginResp.Body.Close()
	require.Equal(t, http.StatusOK, loginResp.StatusCode)

	var loginBody map[string]interface{}
	testutil.ReadJSON(t, loginResp, &loginBody)
	refreshToken, ok := loginBody["refresh_token"].(string)
	require.True(t, ok, "refresh_token should be a string")
	require.NotEmpty(t, refreshToken)

	// Use the refresh token to get a new access token.
	refreshResp := env.DoRequest(t, http.MethodPost, "/auth/refresh", "", map[string]string{
		"refresh_token": refreshToken,
	})
	defer refreshResp.Body.Close()
	require.Equal(t, http.StatusOK, refreshResp.StatusCode)

	var refreshBody map[string]interface{}
	testutil.ReadJSON(t, refreshResp, &refreshBody)

	assert.NotEmpty(t, refreshBody["access_token"], "new access_token should be present")
	assert.NotEmpty(t, refreshBody["refresh_token"], "new refresh_token should be present")
}

// ---------- Logout ----------

func TestLogout_BlacklistsJTI(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "logout-bl", "starter")
	env.CreateUser(t, tenantID, "logout-bl@test.com", testPassword, "admin")

	// Login to get tokens.
	loginResp := env.DoRequest(t, http.MethodPost, "/auth/login", "", map[string]string{
		"email":    "logout-bl@test.com",
		"password": testPassword,
	})
	defer loginResp.Body.Close()
	require.Equal(t, http.StatusOK, loginResp.StatusCode)

	var loginBody map[string]interface{}
	testutil.ReadJSON(t, loginResp, &loginBody)
	accessToken := loginBody["access_token"].(string)
	refreshToken := loginBody["refresh_token"].(string)

	// Logout with the access token in the Authorization header.
	logoutResp := env.DoRequest(t, http.MethodPost, "/auth/logout", accessToken, map[string]string{
		"refresh_token": refreshToken,
	})
	defer logoutResp.Body.Close()
	require.Equal(t, http.StatusOK, logoutResp.StatusCode)

	// Allow time for blacklist cache to be populated.
	time.Sleep(100 * time.Millisecond)

	// Attempt to use the blacklisted access token on /auth/me.
	meResp := env.DoRequest(t, http.MethodGet, "/auth/me", accessToken, nil)
	defer meResp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, meResp.StatusCode)
}

// ---------- Change Password ----------

func TestChangePassword_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "chpw-ok", "starter")
	userID := env.CreateUser(t, tenantID, "chpw-ok@test.com", testPassword, "admin")

	token := env.AuthToken(t, userID, tenantID, "admin")

	newPassword := "NewStr0ng!Pass#42"
	resp := env.DoRequest(t, http.MethodPost, "/auth/change-password", token, map[string]string{
		"current_password": testPassword,
		"new_password":     newPassword,
	})
	defer resp.Body.Close()

	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	testutil.ReadJSON(t, resp, &body)
	assert.Equal(t, "password changed", body["message"])

	// Verify the new password works for login.
	loginResp := env.DoRequest(t, http.MethodPost, "/auth/login", "", map[string]string{
		"email":    "chpw-ok@test.com",
		"password": newPassword,
	})
	defer loginResp.Body.Close()
	assert.Equal(t, http.StatusOK, loginResp.StatusCode)
}

func TestChangePassword_WeakPassword(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "chpw-weak", "starter")
	userID := env.CreateUser(t, tenantID, "chpw-weak@test.com", testPassword, "admin")

	token := env.AuthToken(t, userID, tenantID, "admin")

	resp := env.DoRequest(t, http.MethodPost, "/auth/change-password", token, map[string]string{
		"current_password": testPassword,
		"new_password":     weakPassword,
	})
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
}

// ---------- Me ----------

func TestMe_ReturnsCurrentUser(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "me-ok", "starter")
	userID := env.CreateUser(t, tenantID, "me-ok@test.com", testPassword, "operator")

	token := env.AuthToken(t, userID, tenantID, "operator")

	resp := env.DoRequest(t, http.MethodGet, "/auth/me", token, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	testutil.ReadJSON(t, resp, &body)

	user, ok := body["user"].(map[string]interface{})
	require.True(t, ok, "user should be a JSON object")

	assert.Equal(t, userID.String(), user["id"])
	assert.Equal(t, "me-ok@test.com", user["email"])
	assert.Equal(t, "operator", user["role"])
	assert.Equal(t, "Test", user["first_name"])
	assert.Equal(t, "User", user["last_name"])
}

// ---------- MFA Setup ----------

func TestMFASetup_ReturnsSecretAndURL(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "mfa-setup", "starter")
	userID := env.CreateUser(t, tenantID, "mfa-setup@test.com", testPassword, "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")

	resp := env.DoRequest(t, http.MethodPost, "/auth/mfa/setup", token, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	testutil.ReadJSON(t, resp, &body)

	assert.NotEmpty(t, body["secret"], "secret should be present")
	assert.NotEmpty(t, body["url"], "url should be present")

	// URL should be an otpauth:// URI
	url, ok := body["url"].(string)
	require.True(t, ok)
	assert.Contains(t, url, "otpauth://totp/")
}

func TestMFASetup_AlreadyEnabled(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "mfa-setup-dup", "starter")
	userID := env.CreateUser(t, tenantID, "mfa-setup-dup@test.com", testPassword, "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")

	// Setup MFA
	setupResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/setup", token, nil)
	defer setupResp.Body.Close()
	require.Equal(t, http.StatusOK, setupResp.StatusCode)

	var setupBody map[string]interface{}
	testutil.ReadJSON(t, setupResp, &setupBody)
	secret := setupBody["secret"].(string)

	// Enable MFA with a valid TOTP code
	code, err := totp.GenerateCode(secret, time.Now())
	require.NoError(t, err)

	enableResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/enable", token, map[string]string{
		"code": code,
	})
	defer enableResp.Body.Close()
	require.Equal(t, http.StatusOK, enableResp.StatusCode)

	// Try setup again — should return 409 conflict
	setupResp2 := env.DoRequest(t, http.MethodPost, "/auth/mfa/setup", token, nil)
	defer setupResp2.Body.Close()
	assert.Equal(t, http.StatusConflict, setupResp2.StatusCode)
}

// ---------- MFA Enable ----------

func TestMFAEnable_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "mfa-enable", "starter")
	userID := env.CreateUser(t, tenantID, "mfa-enable@test.com", testPassword, "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")

	// Step 1: Setup MFA to get the secret
	setupResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/setup", token, nil)
	defer setupResp.Body.Close()
	require.Equal(t, http.StatusOK, setupResp.StatusCode)

	var setupBody map[string]interface{}
	testutil.ReadJSON(t, setupResp, &setupBody)
	secret, ok := setupBody["secret"].(string)
	require.True(t, ok)
	require.NotEmpty(t, secret)

	// Step 2: Generate a valid TOTP code from the secret
	code, err := totp.GenerateCode(secret, time.Now())
	require.NoError(t, err)

	// Step 3: Enable MFA with the valid code
	enableResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/enable", token, map[string]string{
		"code": code,
	})
	defer enableResp.Body.Close()
	require.Equal(t, http.StatusOK, enableResp.StatusCode)

	var enableBody map[string]interface{}
	testutil.ReadJSON(t, enableResp, &enableBody)
	assert.Equal(t, "mfa enabled", enableBody["message"])
}

func TestMFAEnable_InvalidCode(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "mfa-enable-bad", "starter")
	userID := env.CreateUser(t, tenantID, "mfa-enable-bad@test.com", testPassword, "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")

	// Setup MFA
	setupResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/setup", token, nil)
	defer setupResp.Body.Close()
	require.Equal(t, http.StatusOK, setupResp.StatusCode)

	// Try to enable with an invalid code
	enableResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/enable", token, map[string]string{
		"code": "000000",
	})
	defer enableResp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, enableResp.StatusCode)
}

func TestMFAEnable_WithoutSetup(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "mfa-nosetup", "starter")
	userID := env.CreateUser(t, tenantID, "mfa-nosetup@test.com", testPassword, "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")

	// Try to enable without calling setup first
	enableResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/enable", token, map[string]string{
		"code": "123456",
	})
	defer enableResp.Body.Close()
	assert.Equal(t, http.StatusUnprocessableEntity, enableResp.StatusCode)
}

// ---------- MFA Disable ----------

func TestMFADisable_Admin(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "mfa-disable", "starter")
	userID := env.CreateUser(t, tenantID, "mfa-disable@test.com", testPassword, "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")

	// Setup and enable MFA
	setupResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/setup", token, nil)
	defer setupResp.Body.Close()
	require.Equal(t, http.StatusOK, setupResp.StatusCode)

	var setupBody map[string]interface{}
	testutil.ReadJSON(t, setupResp, &setupBody)
	secret := setupBody["secret"].(string)

	code, err := totp.GenerateCode(secret, time.Now())
	require.NoError(t, err)

	enableResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/enable", token, map[string]string{
		"code": code,
	})
	defer enableResp.Body.Close()
	require.Equal(t, http.StatusOK, enableResp.StatusCode)

	// Disable MFA as admin
	disableResp := env.DoRequest(t, http.MethodDelete, "/auth/mfa", token, nil)
	defer disableResp.Body.Close()
	require.Equal(t, http.StatusOK, disableResp.StatusCode)

	var disableBody map[string]interface{}
	testutil.ReadJSON(t, disableResp, &disableBody)
	assert.Equal(t, "mfa disabled", disableBody["message"])
}

func TestMFADisable_NonAdmin_Forbidden(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "mfa-dis-op", "starter")
	userID := env.CreateUser(t, tenantID, "mfa-dis-op@test.com", testPassword, "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")

	// Operator should not be able to access DELETE /auth/mfa (RequireAdmin)
	resp := env.DoRequest(t, http.MethodDelete, "/auth/mfa", token, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

// ---------- MFA Login Flow ----------

func TestMFALoginFlow_FullCycle(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "mfa-login", "starter")
	userID := env.CreateUser(t, tenantID, "mfa-login@test.com", testPassword, "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")

	// Setup MFA
	setupResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/setup", token, nil)
	defer setupResp.Body.Close()
	require.Equal(t, http.StatusOK, setupResp.StatusCode)

	var setupBody map[string]interface{}
	testutil.ReadJSON(t, setupResp, &setupBody)
	secret := setupBody["secret"].(string)

	// Enable MFA
	code, err := totp.GenerateCode(secret, time.Now())
	require.NoError(t, err)

	enableResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/enable", token, map[string]string{
		"code": code,
	})
	defer enableResp.Body.Close()
	require.Equal(t, http.StatusOK, enableResp.StatusCode)

	// Login should now return mfa_required + mfa_token instead of access_token
	loginResp := env.DoRequest(t, http.MethodPost, "/auth/login", "", map[string]string{
		"email":    "mfa-login@test.com",
		"password": testPassword,
	})
	defer loginResp.Body.Close()
	require.Equal(t, http.StatusOK, loginResp.StatusCode)

	var loginBody map[string]interface{}
	testutil.ReadJSON(t, loginResp, &loginBody)

	assert.Equal(t, true, loginBody["mfa_required"])
	mfaToken, ok := loginBody["mfa_token"].(string)
	require.True(t, ok, "mfa_token should be a string")
	require.NotEmpty(t, mfaToken)
	assert.Nil(t, loginBody["access_token"], "access_token should NOT be present when MFA is required")

	// Verify MFA with a fresh TOTP code
	verifyCode, err := totp.GenerateCode(secret, time.Now())
	require.NoError(t, err)

	verifyResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/verify", "", map[string]string{
		"mfa_token": mfaToken,
		"code":      verifyCode,
	})
	defer verifyResp.Body.Close()
	require.Equal(t, http.StatusOK, verifyResp.StatusCode)

	var verifyBody map[string]interface{}
	testutil.ReadJSON(t, verifyResp, &verifyBody)

	assert.NotEmpty(t, verifyBody["access_token"], "access_token should be present after MFA verify")
	assert.NotEmpty(t, verifyBody["refresh_token"], "refresh_token should be present after MFA verify")
	assert.NotNil(t, verifyBody["user"], "user should be present after MFA verify")
}

func TestMFAVerify_InvalidCode(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "mfa-verify-bad", "starter")
	userID := env.CreateUser(t, tenantID, "mfa-verify-bad@test.com", testPassword, "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")

	// Setup and enable MFA
	setupResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/setup", token, nil)
	defer setupResp.Body.Close()
	require.Equal(t, http.StatusOK, setupResp.StatusCode)

	var setupBody map[string]interface{}
	testutil.ReadJSON(t, setupResp, &setupBody)
	secret := setupBody["secret"].(string)

	code, err := totp.GenerateCode(secret, time.Now())
	require.NoError(t, err)

	enableResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/enable", token, map[string]string{
		"code": code,
	})
	defer enableResp.Body.Close()
	require.Equal(t, http.StatusOK, enableResp.StatusCode)

	// Login to get mfa_token
	loginResp := env.DoRequest(t, http.MethodPost, "/auth/login", "", map[string]string{
		"email":    "mfa-verify-bad@test.com",
		"password": testPassword,
	})
	defer loginResp.Body.Close()
	require.Equal(t, http.StatusOK, loginResp.StatusCode)

	var loginBody map[string]interface{}
	testutil.ReadJSON(t, loginResp, &loginBody)
	mfaToken := loginBody["mfa_token"].(string)

	// Verify with wrong code
	verifyResp := env.DoRequest(t, http.MethodPost, "/auth/mfa/verify", "", map[string]string{
		"mfa_token": mfaToken,
		"code":      "000000",
	})
	defer verifyResp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, verifyResp.StatusCode)
}
