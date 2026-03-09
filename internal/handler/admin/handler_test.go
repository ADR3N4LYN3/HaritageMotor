package admin_test

import (
	"net/http"
	"testing"

	"github.com/chriis/heritage-motor/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdminDashboard_SuperAdminOnly(t *testing.T) {
	env := testutil.Setup(t)

	// Create a superadmin.
	saID := env.CreateSuperAdmin(t, "sa@test.com", "SuperAdmin1!")
	saToken := env.AuthToken(t, saID, uuid.Nil, "superadmin")

	// Create a regular tenant admin.
	tenantID, _ := env.CreateTenant(t, "acme", "starter")
	adminID := env.CreateUser(t, tenantID, "admin@test.com", "Admin1234!", "admin")
	adminToken := env.AuthToken(t, adminID, tenantID, "admin")

	t.Run("superadmin gets 200", func(t *testing.T) {
		resp := env.DoRequest(t, http.MethodGet, "/admin/dashboard", saToken, nil)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var body map[string]interface{}
		testutil.ReadJSON(t, resp, &body)
		assert.Contains(t, body, "total_tenants")
		assert.Contains(t, body, "active_tenants")
		assert.Contains(t, body, "total_users")
		assert.Contains(t, body, "total_vehicles")
	})

	t.Run("regular admin gets 403", func(t *testing.T) {
		resp := env.DoRequest(t, http.MethodGet, "/admin/dashboard", adminToken, nil)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestAdminListTenants(t *testing.T) {
	env := testutil.Setup(t)

	saID := env.CreateSuperAdmin(t, "sa@test.com", "SuperAdmin1!")
	saToken := env.AuthToken(t, saID, uuid.Nil, "superadmin")

	// Create 2 tenants.
	env.CreateTenant(t, "facility-alpha", "starter")
	env.CreateTenant(t, "facility-beta", "pro")

	resp := env.DoRequest(t, http.MethodGet, "/admin/tenants", saToken, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		Data       []map[string]interface{} `json:"data"`
		TotalCount int                      `json:"total_count"`
		Page       int                      `json:"page"`
		PerPage    int                      `json:"per_page"`
	}
	testutil.ReadJSON(t, resp, &body)

	assert.GreaterOrEqual(t, body.TotalCount, 2)
	assert.GreaterOrEqual(t, len(body.Data), 2)

	// Verify both tenants are present by collecting slugs.
	slugs := make([]string, 0, len(body.Data))
	for _, tenant := range body.Data {
		if s, ok := tenant["slug"].(string); ok {
			slugs = append(slugs, s)
		}
	}
	assert.Contains(t, slugs, "facility-alpha")
	assert.Contains(t, slugs, "facility-beta")
}

func TestAdminCreateTenant_Success(t *testing.T) {
	env := testutil.Setup(t)

	saID := env.CreateSuperAdmin(t, "sa@test.com", "SuperAdmin1!")
	saToken := env.AuthToken(t, saID, uuid.Nil, "superadmin")

	body := map[string]string{
		"name":     "Test Facility",
		"slug":     "test-facility",
		"country":  "FR",
		"timezone": "Europe/Paris",
		"plan":     "starter",
	}

	resp := env.DoRequest(t, http.MethodPost, "/admin/tenants", saToken, body)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var tenant map[string]interface{}
	testutil.ReadJSON(t, resp, &tenant)
	assert.Equal(t, "Test Facility", tenant["name"])
	assert.Equal(t, "test-facility", tenant["slug"])
	assert.Equal(t, "FR", tenant["country"])
	assert.Equal(t, "Europe/Paris", tenant["timezone"])
	assert.Equal(t, "starter", tenant["plan"])
	assert.NotEmpty(t, tenant["id"])
}

func TestAdminCreateTenant_DuplicateSlug_409(t *testing.T) {
	env := testutil.Setup(t)

	saID := env.CreateSuperAdmin(t, "sa@test.com", "SuperAdmin1!")
	saToken := env.AuthToken(t, saID, uuid.Nil, "superadmin")

	body := map[string]string{
		"name":     "Facility One",
		"slug":     "duplicate-slug",
		"country":  "FR",
		"timezone": "Europe/Paris",
		"plan":     "starter",
	}

	// First creation should succeed.
	resp1 := env.DoRequest(t, http.MethodPost, "/admin/tenants", saToken, body)
	defer resp1.Body.Close()
	require.Equal(t, http.StatusCreated, resp1.StatusCode)

	// Second creation with the same slug should return 409.
	body["name"] = "Facility Two"
	resp2 := env.DoRequest(t, http.MethodPost, "/admin/tenants", saToken, body)
	defer resp2.Body.Close()
	assert.Equal(t, http.StatusConflict, resp2.StatusCode)

	var errBody map[string]interface{}
	testutil.ReadJSON(t, resp2, &errBody)
	assert.Equal(t, "conflict", errBody["error"])
}

func TestAdminGetTenant_WithStats(t *testing.T) {
	env := testutil.Setup(t)

	saID := env.CreateSuperAdmin(t, "sa@test.com", "SuperAdmin1!")
	saToken := env.AuthToken(t, saID, uuid.Nil, "superadmin")

	// Create a tenant with users and vehicles.
	tenantID, _ := env.CreateTenant(t, "stats-facility", "pro")
	env.CreateUser(t, tenantID, "user1@test.com", "Test1234!", "operator")
	env.CreateUser(t, tenantID, "user2@test.com", "Test1234!", "viewer")
	env.CreateVehicle(t, tenantID, "Ferrari", "488", "John Doe")
	env.CreateVehicle(t, tenantID, "Porsche", "911", "Jane Smith")
	env.CreateVehicle(t, tenantID, "McLaren", "720S", "Bob Builder")

	resp := env.DoRequest(t, http.MethodGet, "/admin/tenants/"+tenantID.String(), saToken, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var tenant map[string]interface{}
	testutil.ReadJSON(t, resp, &tenant)
	assert.Equal(t, tenantID.String(), tenant["id"])
	assert.Equal(t, "stats-facility", tenant["slug"])

	// Check stats are present and correct.
	userCount, ok := tenant["user_count"].(float64)
	require.True(t, ok, "user_count should be a number")
	assert.Equal(t, float64(2), userCount)

	vehicleCount, ok := tenant["vehicle_count"].(float64)
	require.True(t, ok, "vehicle_count should be a number")
	assert.Equal(t, float64(3), vehicleCount)
}

func TestAdminUpdateTenant_ChangePlan(t *testing.T) {
	env := testutil.Setup(t)

	saID := env.CreateSuperAdmin(t, "sa@test.com", "SuperAdmin1!")
	saToken := env.AuthToken(t, saID, uuid.Nil, "superadmin")

	tenantID, _ := env.CreateTenant(t, "upgrade-facility", "starter")

	body := map[string]string{
		"plan": "pro",
	}

	resp := env.DoRequest(t, http.MethodPatch, "/admin/tenants/"+tenantID.String(), saToken, body)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var tenant map[string]interface{}
	testutil.ReadJSON(t, resp, &tenant)
	assert.Equal(t, "pro", tenant["plan"])
	assert.Equal(t, tenantID.String(), tenant["id"])
}

func TestAdminDeleteTenant(t *testing.T) {
	env := testutil.Setup(t)

	saID := env.CreateSuperAdmin(t, "sa@test.com", "SuperAdmin1!")
	saToken := env.AuthToken(t, saID, uuid.Nil, "superadmin")

	tenantID, _ := env.CreateTenant(t, "delete-me", "starter")

	// Soft-delete the tenant.
	resp := env.DoRequest(t, http.MethodDelete, "/admin/tenants/"+tenantID.String(), saToken, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)

	// Verify the tenant is no longer returned (soft deleted).
	getResp := env.DoRequest(t, http.MethodGet, "/admin/tenants/"+tenantID.String(), saToken, nil)
	defer getResp.Body.Close()
	assert.Equal(t, http.StatusNotFound, getResp.StatusCode)
}
