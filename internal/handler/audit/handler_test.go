package audit_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/chriis/heritage-motor/internal/testutil"
)

// auditListResponse mirrors the paginated JSON envelope returned by GET /audit.
type auditListResponse struct {
	Data       []map[string]interface{} `json:"data"`
	TotalCount int                      `json:"total_count"`
	Page       int                      `json:"page"`
	PerPage    int                      `json:"per_page"`
}

func TestAuditList_AdminCanList(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-audit", "starter")
	adminID := env.CreateUser(t, tenantID, "audit-admin@test.com", "P@ssw0rd!!", "admin")
	adminToken := env.AuthToken(t, adminID, tenantID, "admin")

	// Insert an audit entry directly via ownerPool (bypasses RLS).
	// This avoids depending on the async audit goroutine's timing.
	_, err := env.OwnerPool.Exec(context.Background(),
		`INSERT INTO audit_log (tenant_id, user_id, action, resource_type, ip_address, user_agent, request_id)
		 VALUES ($1, $2, 'vehicles.create', 'vehicle', '127.0.0.1', 'test-agent', 'test-req-id')`,
		tenantID, adminID,
	)
	require.NoError(t, err)

	// Test the API endpoint — should see the entry via appPool with RLS.
	resp := env.DoRequest(t, http.MethodGet, "/audit", adminToken, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body auditListResponse
	testutil.ReadJSON(t, resp, &body)

	assert.GreaterOrEqual(t, body.TotalCount, 1, "should have at least one audit entry")
	assert.GreaterOrEqual(t, len(body.Data), 1)
	assert.Equal(t, 1, body.Page)

	// Verify the entry content
	if len(body.Data) >= 1 {
		assert.Equal(t, "vehicles.create", body.Data[0]["action"])
		assert.Equal(t, "vehicle", body.Data[0]["resource_type"])
	}
}

func TestAuditList_OperatorForbidden(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-audit-op", "starter")
	operatorID := env.CreateUser(t, tenantID, "audit-op@test.com", "P@ssw0rd!!", "operator")
	operatorToken := env.AuthToken(t, operatorID, tenantID, "operator")

	resp := env.DoRequest(t, http.MethodGet, "/audit", operatorToken, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestAuditList_ViewerForbidden(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-audit-view", "starter")
	viewerID := env.CreateUser(t, tenantID, "audit-view@test.com", "P@ssw0rd!!", "viewer")
	viewerToken := env.AuthToken(t, viewerID, tenantID, "viewer")

	resp := env.DoRequest(t, http.MethodGet, "/audit", viewerToken, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestAuditList_WithoutAuth_401(t *testing.T) {
	env := testutil.Setup(t)

	resp := env.DoRequest(t, http.MethodGet, "/audit", "", nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}
