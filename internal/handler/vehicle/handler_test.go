package vehicle_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/chriis/heritage-motor/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------- response types for JSON decoding ----------

type vehicleResp struct {
	ID           string   `json:"id"`
	TenantID     string   `json:"tenant_id"`
	Make         string   `json:"make"`
	Model        string   `json:"model"`
	Year         *int     `json:"year,omitempty"`
	Color        *string  `json:"color,omitempty"`
	LicensePlate *string  `json:"license_plate,omitempty"`
	VIN          *string  `json:"vin,omitempty"`
	OwnerName    string   `json:"owner_name"`
	Status       string   `json:"status"`
	CurrentBayID *string  `json:"current_bay_id,omitempty"`
	Notes        *string  `json:"notes,omitempty"`
	Tags         []string `json:"tags"`
}

type listResp struct {
	Data       []vehicleResp `json:"data"`
	TotalCount int           `json:"total_count"`
	Page       int           `json:"page"`
	PerPage    int           `json:"per_page"`
}

type timelineResp struct {
	Data       []eventResp `json:"data"`
	TotalCount int         `json:"total_count"`
	Page       int         `json:"page"`
	PerPage    int         `json:"per_page"`
}

type eventResp struct {
	ID        string `json:"id"`
	VehicleID string `json:"vehicle_id"`
	EventType string `json:"event_type"`
}

type statusResp struct {
	Status string `json:"status"`
}

// ---------- tests ----------

func TestListVehicles_ReturnsOnlyTenantVehicles(t *testing.T) {
	env := testutil.Setup(t)

	// Tenant A
	tenantA, _ := env.CreateTenant(t, "tenant-a-list", "starter")
	userA := env.CreateUser(t, tenantA, "a-list@test.com", "P@ssw0rd!!", "admin")
	tokenA := env.AuthToken(t, userA, tenantA, "admin")
	env.CreateVehicle(t, tenantA, "Ferrari", "488", "Owner A1")
	env.CreateVehicle(t, tenantA, "Porsche", "911", "Owner A2")

	// Tenant B
	tenantB, _ := env.CreateTenant(t, "tenant-b-list", "starter")
	env.CreateUser(t, tenantB, "b-list@test.com", "P@ssw0rd!!", "admin")
	env.CreateVehicle(t, tenantB, "McLaren", "720S", "Owner B1")

	resp := env.DoRequest(t, http.MethodGet, "/vehicles", tokenA, nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body listResp
	testutil.ReadJSON(t, resp, &body)

	assert.Equal(t, 2, body.TotalCount)
	assert.Len(t, body.Data, 2)
	for _, v := range body.Data {
		assert.Equal(t, tenantA.String(), v.TenantID, "vehicle should belong to tenant A")
	}
}

func TestListVehicles_Search(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-search", "starter")
	userID := env.CreateUser(t, tenantID, "search@test.com", "P@ssw0rd!!", "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")
	env.CreateVehicle(t, tenantID, "Ferrari", "488", "Owner 1")
	env.CreateVehicle(t, tenantID, "Ferrari", "F40", "Owner 2")
	env.CreateVehicle(t, tenantID, "Porsche", "911", "Owner 3")

	resp := env.DoRequest(t, http.MethodGet, "/vehicles?search=Ferrari", token, nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body listResp
	testutil.ReadJSON(t, resp, &body)

	assert.Equal(t, 2, body.TotalCount)
	assert.Len(t, body.Data, 2)
	for _, v := range body.Data {
		assert.Equal(t, "Ferrari", v.Make)
	}
}

func TestCreateVehicle_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-create", "starter")
	userID := env.CreateUser(t, tenantID, "create@test.com", "P@ssw0rd!!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")

	payload := map[string]interface{}{
		"make":       "Bugatti",
		"model":      "Chiron",
		"owner_name": "Jean Dupont",
	}

	resp := env.DoRequest(t, http.MethodPost, "/vehicles", token, payload)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var v vehicleResp
	testutil.ReadJSON(t, resp, &v)

	assert.Equal(t, "Bugatti", v.Make)
	assert.Equal(t, "Chiron", v.Model)
	assert.Equal(t, "Jean Dupont", v.OwnerName)
	assert.Equal(t, "stored", v.Status)
	assert.NotEmpty(t, v.ID)
	assert.Equal(t, tenantID.String(), v.TenantID)
}

func TestCreateVehicle_TechnicianForbidden(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-tech-forbid", "starter")
	userID := env.CreateUser(t, tenantID, "tech-forbid@test.com", "P@ssw0rd!!", "technician")
	token := env.AuthToken(t, userID, tenantID, "technician")

	payload := map[string]interface{}{
		"make":       "Lamborghini",
		"model":      "Aventador",
		"owner_name": "Test Owner",
	}

	resp := env.DoRequest(t, http.MethodPost, "/vehicles", token, payload)
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestGetVehicle_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-get", "starter")
	userID := env.CreateUser(t, tenantID, "get@test.com", "P@ssw0rd!!", "viewer")
	token := env.AuthToken(t, userID, tenantID, "viewer")
	vehicleID := env.CreateVehicle(t, tenantID, "Porsche", "Carrera GT", "Hans Muller")

	resp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/vehicles/%s", vehicleID), token, nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var v vehicleResp
	testutil.ReadJSON(t, resp, &v)

	assert.Equal(t, vehicleID.String(), v.ID)
	assert.Equal(t, "Porsche", v.Make)
	assert.Equal(t, "Carrera GT", v.Model)
	assert.Equal(t, "Hans Muller", v.OwnerName)
}

func TestGetVehicle_CrossTenant_404(t *testing.T) {
	env := testutil.Setup(t)

	// Create vehicle in tenant A
	tenantA, _ := env.CreateTenant(t, "tenant-cross-a", "starter")
	env.CreateUser(t, tenantA, "cross-a@test.com", "P@ssw0rd!!", "admin")
	vehicleID := env.CreateVehicle(t, tenantA, "Ferrari", "LaFerrari", "Owner A")

	// Authenticate as tenant B
	tenantB, _ := env.CreateTenant(t, "tenant-cross-b", "starter")
	userB := env.CreateUser(t, tenantB, "cross-b@test.com", "P@ssw0rd!!", "admin")
	tokenB := env.AuthToken(t, userB, tenantB, "admin")

	resp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/vehicles/%s", vehicleID), tokenB, nil)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode, "cross-tenant access must return 404, not 403")
}

func TestUpdateVehicle_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-update", "starter")
	userID := env.CreateUser(t, tenantID, "update@test.com", "P@ssw0rd!!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")
	vehicleID := env.CreateVehicle(t, tenantID, "Porsche", "911", "Owner Orig")

	payload := map[string]interface{}{
		"color": "Red",
	}

	resp := env.DoRequest(t, http.MethodPatch, fmt.Sprintf("/vehicles/%s", vehicleID), token, payload)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var v vehicleResp
	testutil.ReadJSON(t, resp, &v)

	assert.Equal(t, vehicleID.String(), v.ID)
	require.NotNil(t, v.Color)
	assert.Equal(t, "Red", *v.Color)
	// Unchanged fields stay the same.
	assert.Equal(t, "Porsche", v.Make)
	assert.Equal(t, "911", v.Model)
}

func TestDeleteVehicle_AdminOnly(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-delete", "starter")
	operatorID := env.CreateUser(t, tenantID, "del-operator@test.com", "P@ssw0rd!!", "operator")
	adminID := env.CreateUser(t, tenantID, "del-admin@test.com", "P@ssw0rd!!", "admin")
	operatorToken := env.AuthToken(t, operatorID, tenantID, "operator")
	adminToken := env.AuthToken(t, adminID, tenantID, "admin")
	vehicleID := env.CreateVehicle(t, tenantID, "BMW", "M3", "Owner Del")

	// Operator cannot delete
	resp := env.DoRequest(t, http.MethodDelete, fmt.Sprintf("/vehicles/%s", vehicleID), operatorToken, nil)
	assert.Equal(t, http.StatusForbidden, resp.StatusCode, "operator should not be able to delete")

	// Admin can delete
	resp = env.DoRequest(t, http.MethodDelete, fmt.Sprintf("/vehicles/%s", vehicleID), adminToken, nil)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode, "admin should be able to delete")

	// Vehicle is gone (soft-deleted)
	resp = env.DoRequest(t, http.MethodGet, fmt.Sprintf("/vehicles/%s", vehicleID), adminToken, nil)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode, "deleted vehicle should not be found")
}

func TestMoveVehicle_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-move", "starter")
	userID := env.CreateUser(t, tenantID, "move@test.com", "P@ssw0rd!!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")
	vehicleID := env.CreateVehicle(t, tenantID, "Mercedes", "SLS AMG", "Owner Move")
	bayID := env.CreateBay(t, tenantID, "BAY-M01")

	payload := map[string]interface{}{
		"bay_id": bayID.String(),
	}

	resp := env.DoRequest(t, http.MethodPost, fmt.Sprintf("/vehicles/%s/move", vehicleID), token, payload)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var sr statusResp
	testutil.ReadJSON(t, resp, &sr)
	assert.Equal(t, "moved", sr.Status)

	// Verify the vehicle's current_bay_id was updated.
	getResp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/vehicles/%s", vehicleID), token, nil)
	require.Equal(t, http.StatusOK, getResp.StatusCode)

	var v vehicleResp
	testutil.ReadJSON(t, getResp, &v)
	require.NotNil(t, v.CurrentBayID)
	assert.Equal(t, bayID.String(), *v.CurrentBayID)
}

func TestExitVehicle_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-exit", "starter")
	userID := env.CreateUser(t, tenantID, "exit@test.com", "P@ssw0rd!!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")
	vehicleID := env.CreateVehicle(t, tenantID, "Aston Martin", "DB11", "Owner Exit")
	bayID := env.CreateBay(t, tenantID, "BAY-E01")

	// First, move the vehicle to a bay so exit has something to clear.
	movePayload := map[string]interface{}{
		"bay_id": bayID.String(),
	}
	moveResp := env.DoRequest(t, http.MethodPost, fmt.Sprintf("/vehicles/%s/move", vehicleID), token, movePayload)
	require.Equal(t, http.StatusOK, moveResp.StatusCode)

	// Now exit the vehicle.
	exitPayload := map[string]interface{}{
		"notes": "picked up by owner",
	}
	resp := env.DoRequest(t, http.MethodPost, fmt.Sprintf("/vehicles/%s/exit", vehicleID), token, exitPayload)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var sr statusResp
	testutil.ReadJSON(t, resp, &sr)
	assert.Equal(t, "exited", sr.Status)

	// Verify the vehicle status is now "out".
	getResp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/vehicles/%s", vehicleID), token, nil)
	require.Equal(t, http.StatusOK, getResp.StatusCode)

	var v vehicleResp
	testutil.ReadJSON(t, getResp, &v)
	assert.Equal(t, "out", v.Status)
	assert.Nil(t, v.CurrentBayID, "bay should be cleared after exit")
}

func TestGetTimeline_ReturnsEvents(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-timeline", "starter")
	userID := env.CreateUser(t, tenantID, "timeline@test.com", "P@ssw0rd!!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")

	// Create a vehicle via API so the intake event is recorded.
	createPayload := map[string]interface{}{
		"make":       "Rolls-Royce",
		"model":      "Silver Ghost",
		"owner_name": "Timeline Owner",
	}
	createResp := env.DoRequest(t, http.MethodPost, "/vehicles", token, createPayload)
	require.Equal(t, http.StatusCreated, createResp.StatusCode)

	var created vehicleResp
	testutil.ReadJSON(t, createResp, &created)
	vehicleID, err := uuid.Parse(created.ID)
	require.NoError(t, err)

	// Move the vehicle to generate a second event.
	bayID := env.CreateBay(t, tenantID, "BAY-T01")
	movePayload := map[string]interface{}{
		"bay_id": bayID.String(),
	}
	moveResp := env.DoRequest(t, http.MethodPost, fmt.Sprintf("/vehicles/%s/move", vehicleID), token, movePayload)
	require.Equal(t, http.StatusOK, moveResp.StatusCode)

	// Fetch the timeline.
	resp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/vehicles/%s/timeline", vehicleID), token, nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body timelineResp
	testutil.ReadJSON(t, resp, &body)

	assert.GreaterOrEqual(t, body.TotalCount, 2, "should have at least intake + move events")
	assert.GreaterOrEqual(t, len(body.Data), 2)

	// Collect event types present.
	types := make(map[string]bool)
	for _, ev := range body.Data {
		types[ev.EventType] = true
		assert.Equal(t, vehicleID.String(), ev.VehicleID, "event should belong to the vehicle")
	}
	assert.True(t, types["vehicle_intake"], "timeline should contain a vehicle_intake event")
	assert.True(t, types["vehicle_moved"], "timeline should contain a vehicle_moved event")
}
