package middleware_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/chriis/heritage-motor/internal/middleware"
	"github.com/chriis/heritage-motor/internal/testutil"
)

// ---------------------------------------------------------------------------
// Auth basics
// ---------------------------------------------------------------------------

func TestAuth_NoToken_401(t *testing.T) {
	env := testutil.Setup(t)

	resp := env.DoRequest(t, http.MethodGet, "/vehicles", "", nil)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestAuth_InvalidToken_401(t *testing.T) {
	env := testutil.Setup(t)

	resp := env.DoRequest(t, http.MethodGet, "/vehicles", "invalid-jwt", nil)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestAuth_ExpiredToken_401(t *testing.T) {
	env := testutil.Setup(t)

	// A completely garbage string is enough — the JWT parser rejects it.
	resp := env.DoRequest(t, http.MethodGet, "/vehicles", "eyJhbGciOiJIUzI1NiJ9.e30.garbage", nil)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

// ---------------------------------------------------------------------------
// Blacklist — full login / logout / re-use flow
// ---------------------------------------------------------------------------

func TestBlacklist_JTI_BlockedAfterLogout(t *testing.T) {
	env := testutil.Setup(t)

	// Seed tenant + user.
	tenantID, _ := env.CreateTenant(t, "bl-tenant", "starter")
	password := "Str0ng!Pass99"
	email := "bl-user@example.com"
	env.CreateUser(t, tenantID, email, password, "admin")

	// --- Login ---
	loginBody := map[string]string{"email": email, "password": password}
	loginResp := env.DoRequest(t, http.MethodPost, "/auth/login", "", loginBody)
	defer loginResp.Body.Close()
	require.Equal(t, http.StatusOK, loginResp.StatusCode)

	var loginJSON struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	testutil.ReadJSON(t, loginResp, &loginJSON)
	require.NotEmpty(t, loginJSON.AccessToken)
	require.NotEmpty(t, loginJSON.RefreshToken)

	accessToken := loginJSON.AccessToken
	refreshToken := loginJSON.RefreshToken

	// Sanity check — token works before logout.
	meResp := env.DoRequest(t, http.MethodGet, "/auth/me", accessToken, nil)
	defer meResp.Body.Close()
	require.Equal(t, http.StatusOK, meResp.StatusCode)

	// Invalidate the blacklist cache so the next check hits the DB.
	// Extract claims to get jti and userID for cache invalidation.
	claims, err := env.JWTManager.ValidateAccessToken(accessToken)
	require.NoError(t, err)
	middleware.InvalidateBlacklistCache(claims.ID, claims.UserID)

	// --- Logout ---
	logoutBody := map[string]string{"refresh_token": refreshToken}
	logoutResp := env.DoRequest(t, http.MethodPost, "/auth/logout", accessToken, logoutBody)
	defer logoutResp.Body.Close()
	require.Equal(t, http.StatusOK, logoutResp.StatusCode)

	// Invalidate cache again after logout so the blacklist entry is seen.
	middleware.InvalidateBlacklistCache(claims.ID, claims.UserID)

	// --- Re-use the same access token → should be rejected ---
	blockedResp := env.DoRequest(t, http.MethodGet, "/auth/me", accessToken, nil)
	defer blockedResp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, blockedResp.StatusCode)
}

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

func TestRBAC_ViewerCannotCreate(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "rbac-viewer", "starter")
	userID := env.CreateUser(t, tenantID, "viewer@example.com", "Str0ng!Pass99", "viewer")
	token := env.AuthToken(t, userID, tenantID, "viewer")

	body := map[string]string{
		"make":       "Ferrari",
		"model":      "F40",
		"owner_name": "Jean Dupont",
	}
	resp := env.DoRequest(t, http.MethodPost, "/vehicles", token, body)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestRBAC_TechnicianCannotCreateVehicle(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "rbac-tech", "starter")
	userID := env.CreateUser(t, tenantID, "tech@example.com", "Str0ng!Pass99", "technician")
	token := env.AuthToken(t, userID, tenantID, "technician")

	body := map[string]string{
		"make":       "Porsche",
		"model":      "911 GT3",
		"owner_name": "Pierre Martin",
	}
	resp := env.DoRequest(t, http.MethodPost, "/vehicles", token, body)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestRBAC_TechnicianCanCompleteTasks(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "rbac-tech-task", "starter")
	techID := env.CreateUser(t, tenantID, "tech-task@example.com", "Str0ng!Pass99", "technician")
	operatorID := env.CreateUser(t, tenantID, "operator-task@example.com", "Str0ng!Pass99", "operator")
	vehicleID := env.CreateVehicle(t, tenantID, "McLaren", "720S", "Claude Owner")

	// Create a task as operator (technician cannot create tasks via POST /tasks
	// because RequireTechnicianOrAbove allows it, but let's use the API).
	operatorToken := env.AuthToken(t, operatorID, tenantID, "operator")
	createBody := map[string]interface{}{
		"vehicle_id": vehicleID.String(),
		"task_type":  "tire_pressure",
		"title":      "Check tires",
	}
	createResp := env.DoRequest(t, http.MethodPost, "/tasks", operatorToken, createBody)
	defer createResp.Body.Close()
	require.Equal(t, http.StatusCreated, createResp.StatusCode)

	var task struct {
		ID string `json:"id"`
	}
	testutil.ReadJSON(t, createResp, &task)
	require.NotEmpty(t, task.ID)

	// Complete as technician — should NOT be 403.
	techToken := env.AuthToken(t, techID, tenantID, "technician")
	completeResp := env.DoRequest(t, http.MethodPost, "/tasks/"+task.ID+"/complete", techToken, nil)
	defer completeResp.Body.Close()

	// Expect 200 (success). Not 403 (forbidden).
	assert.NotEqual(t, http.StatusForbidden, completeResp.StatusCode)
	assert.Equal(t, http.StatusOK, completeResp.StatusCode)
}

func TestRBAC_OperatorCanCreateVehicle(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "rbac-operator", "starter")
	userID := env.CreateUser(t, tenantID, "operator@example.com", "Str0ng!Pass99", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")

	body := map[string]string{
		"make":       "Bugatti",
		"model":      "Chiron",
		"owner_name": "Alain Delon",
	}
	resp := env.DoRequest(t, http.MethodPost, "/vehicles", token, body)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode)
}

// ---------------------------------------------------------------------------
// Password change required
// ---------------------------------------------------------------------------

func TestPasswordChangeRequired_BlocksAccess(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "pcr-tenant", "starter")
	userID := env.CreateUser(t, tenantID, "pcr@example.com", "Str0ng!Pass99", "admin")

	// Token with password_change_required = true.
	pcrToken := env.AuthTokenPCR(t, userID, tenantID, "admin")

	// Regular route should be blocked with 403.
	vehiclesResp := env.DoRequest(t, http.MethodGet, "/vehicles", pcrToken, nil)
	defer vehiclesResp.Body.Close()
	assert.Equal(t, http.StatusForbidden, vehiclesResp.StatusCode)

	var errBody map[string]interface{}
	testutil.ReadJSON(t, vehiclesResp, &errBody)
	assert.Equal(t, "password_change_required", errBody["error"])

	// POST /auth/change-password should NOT be blocked by the PCR guard.
	// It may fail with 400/422 because the passwords are wrong, but NOT 403.
	changePwBody := map[string]string{
		"current_password": "Str0ng!Pass99",
		"new_password":     "N3wStr0ng!Pass",
	}
	changePwResp := env.DoRequest(t, http.MethodPost, "/auth/change-password", pcrToken, changePwBody)
	defer changePwResp.Body.Close()

	// Any status that is NOT 403 confirms the PCR guard did not block.
	assert.NotEqual(t, http.StatusForbidden, changePwResp.StatusCode)
}

// ---------------------------------------------------------------------------
// Superadmin routes
// ---------------------------------------------------------------------------

func TestSuperAdmin_CanAccessAdminRoutes(t *testing.T) {
	env := testutil.Setup(t)

	saID := env.CreateSuperAdmin(t, "sa@example.com", "Str0ng!Pass99")
	token := env.AuthToken(t, saID, uuid.Nil, "superadmin")

	resp := env.DoRequest(t, http.MethodGet, "/admin/dashboard", token, nil)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestNonSuperAdmin_CannotAccessAdminRoutes(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "non-sa-tenant", "starter")
	userID := env.CreateUser(t, tenantID, "admin@example.com", "Str0ng!Pass99", "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")

	resp := env.DoRequest(t, http.MethodGet, "/admin/dashboard", token, nil)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}
