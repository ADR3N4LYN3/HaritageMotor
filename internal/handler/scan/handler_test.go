package scan_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/chriis/heritage-motor/internal/testutil"
)

// scanResponse mirrors the JSON returned by GET /scan/:token.
type scanResponse struct {
	EntityType string   `json:"entity_type"`
	EntityID   string   `json:"entity_id"`
	EntityName string   `json:"entity_name"`
	Actions    []string `json:"actions"`
}

func TestScanVehicle_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-scan-v", "starter")
	userID := env.CreateUser(t, tenantID, "scan-v@test.com", "P@ssw0rd!!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")
	vehicleID := env.CreateVehicle(t, tenantID, "Ferrari", "488", "Owner Scan")

	// Set a qr_token on the vehicle directly.
	qrToken := "veh-qr-token-001"
	_, err := env.OwnerPool.Exec(context.Background(),
		`UPDATE vehicles SET qr_token = $1 WHERE id = $2`, qrToken, vehicleID)
	require.NoError(t, err)

	resp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/scan/%s", qrToken), token, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body scanResponse
	testutil.ReadJSON(t, resp, &body)

	assert.Equal(t, "vehicle", body.EntityType)
	assert.Equal(t, vehicleID.String(), body.EntityID)
	assert.Equal(t, "Ferrari 488", body.EntityName)
	// Operator should get move, task, photo, exit actions.
	assert.ElementsMatch(t, []string{"move", "task", "photo", "exit"}, body.Actions)
}

func TestScanBay_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-scan-b", "starter")
	userID := env.CreateUser(t, tenantID, "scan-b@test.com", "P@ssw0rd!!", "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")
	bayID := env.CreateBay(t, tenantID, "BAY-SCAN-01")

	// Set a qr_token on the bay directly.
	qrToken := "bay-qr-token-001"
	_, err := env.OwnerPool.Exec(context.Background(),
		`UPDATE bays SET qr_token = $1 WHERE id = $2`, qrToken, bayID)
	require.NoError(t, err)

	resp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/scan/%s", qrToken), token, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body scanResponse
	testutil.ReadJSON(t, resp, &body)

	assert.Equal(t, "bay", body.EntityType)
	assert.Equal(t, bayID.String(), body.EntityID)
	assert.Equal(t, "BAY-SCAN-01", body.EntityName)
	assert.Empty(t, body.Actions, "bay scan should return no actions")
}

func TestScanUnknownToken_404(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-scan-404", "starter")
	userID := env.CreateUser(t, tenantID, "scan-404@test.com", "P@ssw0rd!!", "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")

	resp := env.DoRequest(t, http.MethodGet, "/scan/nonexistent-qr-token", token, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestScan_WithoutAuth_401(t *testing.T) {
	env := testutil.Setup(t)

	resp := env.DoRequest(t, http.MethodGet, "/scan/any-token", "", nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestScanVehicle_TechnicianActions(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-scan-tech", "starter")
	userID := env.CreateUser(t, tenantID, "scan-tech@test.com", "P@ssw0rd!!", "technician")
	token := env.AuthToken(t, userID, tenantID, "technician")
	vehicleID := env.CreateVehicle(t, tenantID, "Porsche", "911", "Owner Tech")

	qrToken := "veh-qr-token-tech"
	_, err := env.OwnerPool.Exec(context.Background(),
		`UPDATE vehicles SET qr_token = $1 WHERE id = $2`, qrToken, vehicleID)
	require.NoError(t, err)

	resp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/scan/%s", qrToken), token, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body scanResponse
	testutil.ReadJSON(t, resp, &body)

	assert.Equal(t, "vehicle", body.EntityType)
	// Technician should only get task and photo actions.
	assert.ElementsMatch(t, []string{"task", "photo"}, body.Actions)
}

func TestScanVehicle_ViewerActions(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-scan-view", "starter")
	userID := env.CreateUser(t, tenantID, "scan-view@test.com", "P@ssw0rd!!", "viewer")
	token := env.AuthToken(t, userID, tenantID, "viewer")
	vehicleID := env.CreateVehicle(t, tenantID, "McLaren", "720S", "Owner View")

	qrToken := "veh-qr-token-view"
	_, err := env.OwnerPool.Exec(context.Background(),
		`UPDATE vehicles SET qr_token = $1 WHERE id = $2`, qrToken, vehicleID)
	require.NoError(t, err)

	resp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/scan/%s", qrToken), token, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body scanResponse
	testutil.ReadJSON(t, resp, &body)

	assert.Equal(t, "vehicle", body.EntityType)
	// Viewer should get no actions.
	assert.Empty(t, body.Actions)
}
