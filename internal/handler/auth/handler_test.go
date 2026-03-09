package auth_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/chriis/heritage-motor/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
