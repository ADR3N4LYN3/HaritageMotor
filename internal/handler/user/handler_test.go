package user_test

import (
	"net/http"
	"testing"

	"github.com/chriis/heritage-motor/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListUsers_AdminOnly(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "list-users-tenant", "starter")
	adminID := env.CreateUser(t, tenantID, "admin@test.com", "Admin1234!", "admin")
	operatorID := env.CreateUser(t, tenantID, "operator@test.com", "Oper1234!", "operator")

	adminToken := env.AuthToken(t, adminID, tenantID, "admin")
	operatorToken := env.AuthToken(t, operatorID, tenantID, "operator")

	t.Run("operator gets 403", func(t *testing.T) {
		resp := env.DoRequest(t, http.MethodGet, "/users", operatorToken, nil)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("admin gets 200", func(t *testing.T) {
		resp := env.DoRequest(t, http.MethodGet, "/users", adminToken, nil)
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
		assert.Equal(t, 1, body.Page)
		assert.Equal(t, 20, body.PerPage)

		// Verify both users are in the list.
		emails := make([]string, 0, len(body.Data))
		for _, u := range body.Data {
			if e, ok := u["email"].(string); ok {
				emails = append(emails, e)
			}
		}
		assert.Contains(t, emails, "admin@test.com")
		assert.Contains(t, emails, "operator@test.com")
	})
}

func TestCreateUser_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "create-user-tenant", "starter")
	adminID := env.CreateUser(t, tenantID, "admin@test.com", "Admin1234!", "admin")
	adminToken := env.AuthToken(t, adminID, tenantID, "admin")

	body := map[string]string{
		"email":      "new@test.com",
		"password":   "Test1234!",
		"first_name": "New",
		"last_name":  "User",
		"role":       "operator",
	}

	resp := env.DoRequest(t, http.MethodPost, "/users", adminToken, body)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var user map[string]interface{}
	testutil.ReadJSON(t, resp, &user)
	assert.Equal(t, "new@test.com", user["email"])
	assert.Equal(t, "New", user["first_name"])
	assert.Equal(t, "User", user["last_name"])
	assert.Equal(t, "operator", user["role"])
	assert.NotEmpty(t, user["id"])
}

func TestCreateUser_DuplicateEmail_409(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "dup-email-tenant", "starter")
	adminID := env.CreateUser(t, tenantID, "admin@test.com", "Admin1234!", "admin")
	adminToken := env.AuthToken(t, adminID, tenantID, "admin")

	body := map[string]string{
		"email":      "duplicate@test.com",
		"password":   "Test1234!",
		"first_name": "First",
		"last_name":  "User",
		"role":       "operator",
	}

	// First creation should succeed.
	resp1 := env.DoRequest(t, http.MethodPost, "/users", adminToken, body)
	defer resp1.Body.Close()
	require.Equal(t, http.StatusCreated, resp1.StatusCode)

	// Second creation with the same email should return 409.
	body["first_name"] = "Second"
	resp2 := env.DoRequest(t, http.MethodPost, "/users", adminToken, body)
	defer resp2.Body.Close()
	assert.Equal(t, http.StatusConflict, resp2.StatusCode)

	var errBody map[string]interface{}
	testutil.ReadJSON(t, resp2, &errBody)
	assert.Equal(t, "conflict", errBody["error"])
}

func TestUpdateUser_ChangeRole(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "update-user-tenant", "starter")
	adminID := env.CreateUser(t, tenantID, "admin@test.com", "Admin1234!", "admin")
	targetID := env.CreateUser(t, tenantID, "target@test.com", "Target1234!", "operator")
	adminToken := env.AuthToken(t, adminID, tenantID, "admin")

	body := map[string]string{
		"role": "technician",
	}

	resp := env.DoRequest(t, http.MethodPatch, "/users/"+targetID.String(), adminToken, body)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var user map[string]interface{}
	testutil.ReadJSON(t, resp, &user)
	assert.Equal(t, "technician", user["role"])
	assert.Equal(t, targetID.String(), user["id"])
}

func TestDeleteUser_SoftDelete(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "delete-user-tenant", "starter")
	adminID := env.CreateUser(t, tenantID, "admin@test.com", "Admin1234!", "admin")
	victimID := env.CreateUser(t, tenantID, "victim@test.com", "Victim1234!", "viewer")
	adminToken := env.AuthToken(t, adminID, tenantID, "admin")

	// Delete the user.
	resp := env.DoRequest(t, http.MethodDelete, "/users/"+victimID.String(), adminToken, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)

	// Verify deleted user does not appear in the list.
	listResp := env.DoRequest(t, http.MethodGet, "/users", adminToken, nil)
	defer listResp.Body.Close()
	require.Equal(t, http.StatusOK, listResp.StatusCode)

	var body struct {
		Data       []map[string]interface{} `json:"data"`
		TotalCount int                      `json:"total_count"`
	}
	testutil.ReadJSON(t, listResp, &body)

	for _, u := range body.Data {
		email, _ := u["email"].(string)
		assert.NotEqual(t, "victim@test.com", email, "deleted user should not appear in user list")
	}
}
