package audit_test

import (
	"net/http"
	"testing"
	"time"

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

	// First, perform a POST action to generate an audit entry.
	// Creating a vehicle via API triggers the audit middleware.
	payload := map[string]interface{}{
		"make":       "Ferrari",
		"model":      "F40",
		"owner_name": "Audit Owner",
	}
	// Need an operator-or-above to create vehicles; admin qualifies.
	createResp := env.DoRequest(t, http.MethodPost, "/vehicles", adminToken, payload)
	defer createResp.Body.Close()
	require.Equal(t, http.StatusCreated, createResp.StatusCode)

	// The audit middleware writes asynchronously in a goroutine.
	// Poll until the entry appears (max ~2s).
	var body auditListResponse
	for i := 0; i < 20; i++ {
		time.Sleep(100 * time.Millisecond)

		resp := env.DoRequest(t, http.MethodGet, "/audit", adminToken, nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		testutil.ReadJSON(t, resp, &body)
		resp.Body.Close()

		if body.TotalCount >= 1 {
			break
		}
	}

	assert.GreaterOrEqual(t, body.TotalCount, 1, "should have at least one audit entry from the vehicle creation")
	assert.GreaterOrEqual(t, len(body.Data), 1)
	assert.Equal(t, 1, body.Page)
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
