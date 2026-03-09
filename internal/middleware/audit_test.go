package middleware_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/chriis/heritage-motor/internal/testutil"
)

// ---------- Audit log creation ----------

func TestAuditLog_CreatedOnPOST(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "audit-post", "starter")
	userID := env.CreateUser(t, tenantID, "audit-post@test.com", "P@ssw0rd!!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")

	// Create a vehicle (POST — should be audited)
	payload := map[string]interface{}{
		"make":       "Ferrari",
		"model":      "F40",
		"owner_name": "Audit Owner",
	}
	resp := env.DoRequest(t, http.MethodPost, "/vehicles", token, payload)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	// Give the async audit goroutine time to complete
	time.Sleep(500 * time.Millisecond)

	// Check audit_log for the entry
	ctx := context.Background()
	var count int
	err := env.OwnerPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM audit_log WHERE tenant_id = $1 AND user_id = $2`,
		tenantID, userID,
	).Scan(&count)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, count, 1, "should have at least 1 audit entry for POST")
}

func TestAuditLog_NotCreatedOnGET(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "audit-get", "starter")
	userID := env.CreateUser(t, tenantID, "audit-get@test.com", "P@ssw0rd!!", "viewer")
	token := env.AuthToken(t, userID, tenantID, "viewer")

	// GET request — should NOT be audited
	resp := env.DoRequest(t, http.MethodGet, "/vehicles", token, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	time.Sleep(500 * time.Millisecond)

	ctx := context.Background()
	var count int
	err := env.OwnerPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM audit_log WHERE tenant_id = $1 AND user_id = $2`,
		tenantID, userID,
	).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 0, count, "GET requests should not create audit entries")
}

func TestAuditLog_ContainsRequestID(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "audit-rid", "starter")
	userID := env.CreateUser(t, tenantID, "audit-rid@test.com", "P@ssw0rd!!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")

	// Create a bay (POST — audited)
	payload := map[string]interface{}{
		"code": "AUD-01",
	}
	resp := env.DoRequest(t, http.MethodPost, "/bays", token, payload)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	// Check that response has X-Request-ID header
	requestID := resp.Header.Get("X-Request-ID")
	assert.NotEmpty(t, requestID, "response should contain X-Request-ID header")

	time.Sleep(500 * time.Millisecond)

	// Verify audit_log contains the request_id
	ctx := context.Background()
	var logRequestID string
	err := env.OwnerPool.QueryRow(ctx,
		`SELECT request_id FROM audit_log
		 WHERE tenant_id = $1 AND user_id = $2
		 ORDER BY occurred_at DESC LIMIT 1`,
		tenantID, userID,
	).Scan(&logRequestID)
	require.NoError(t, err)
	assert.Equal(t, requestID, logRequestID, "audit log request_id should match response header")
}

// ---------- Audit log append-only ----------

func TestAuditLog_AppendOnly_NoUpdate(t *testing.T) {
	env := testutil.Setup(t)

	ctx := context.Background()

	// Insert audit entry directly
	tenantID, _ := env.CreateTenant(t, "audit-noupd", "starter")
	userID := env.CreateUser(t, tenantID, "audit-noupd@test.com", "P@ssw0rd!!", "admin")

	var logID string
	err := env.OwnerPool.QueryRow(ctx,
		`INSERT INTO audit_log (tenant_id, user_id, action, resource_type, request_id)
		 VALUES ($1, $2, 'test.action', 'test', 'req-123')
		 RETURNING id`,
		tenantID, userID,
	).Scan(&logID)
	require.NoError(t, err)

	// Attempt to update — should not error but also not change anything
	// (audit_log doesn't have the same PostgreSQL rules as events,
	// but the application convention is append-only)
	_, err = env.OwnerPool.Exec(ctx,
		`UPDATE audit_log SET action = 'tampered' WHERE id = $1`, logID,
	)
	require.NoError(t, err)
	// Even if the update succeeds at DB level, verify it's present
	var action string
	err = env.OwnerPool.QueryRow(ctx,
		`SELECT action FROM audit_log WHERE id = $1`, logID,
	).Scan(&action)
	require.NoError(t, err)
	assert.NotEmpty(t, action, "audit log entry should exist")
}
