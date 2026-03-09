package bay_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/chriis/heritage-motor/internal/testutil"
)

// listBaysResponse mirrors the paginated JSON envelope returned by GET /bays.
type listBaysResponse struct {
	Data       []bayItem `json:"data"`
	TotalCount int       `json:"total_count"`
	Page       int       `json:"page"`
	PerPage    int       `json:"per_page"`
}

type bayItem struct {
	ID   uuid.UUID `json:"id"`
	Code string    `json:"code"`
	Zone *string   `json:"zone,omitempty"`
}

// createBayResponse is used for POST /bays → 201.
type createBayResponse struct {
	ID     uuid.UUID `json:"id"`
	Code   string    `json:"code"`
	Zone   *string   `json:"zone,omitempty"`
	Status string    `json:"status"`
}

// updateBayResponse is used for PATCH /bays/:id.
type updateBayResponse struct {
	ID          uuid.UUID `json:"id"`
	Code        string    `json:"code"`
	Description *string   `json:"description,omitempty"`
}

func TestListBays_ReturnsOnlyTenantBays(t *testing.T) {
	env := testutil.Setup(t)

	// Tenant A with two bays
	tenantA, _ := env.CreateTenant(t, "tenant-a-bay", "starter")
	userA := env.CreateUser(t, tenantA, "a-bay@test.com", "Password1!", "admin")
	tokenA := env.AuthToken(t, userA, tenantA, "admin")
	env.CreateBay(t, tenantA, "A-01")
	env.CreateBay(t, tenantA, "A-02")

	// Tenant B with one bay
	tenantB, _ := env.CreateTenant(t, "tenant-b-bay", "starter")
	userB := env.CreateUser(t, tenantB, "b-bay@test.com", "Password1!", "admin")
	tokenB := env.AuthToken(t, userB, tenantB, "admin")
	env.CreateBay(t, tenantB, "B-01")

	// Tenant A should see only its own bays
	resp := env.DoRequest(t, http.MethodGet, "/bays", tokenA, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var listA listBaysResponse
	testutil.ReadJSON(t, resp, &listA)
	assert.Equal(t, 2, listA.TotalCount)
	assert.Len(t, listA.Data, 2)

	// Tenant B should see only its own bay
	resp = env.DoRequest(t, http.MethodGet, "/bays", tokenB, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var listB listBaysResponse
	testutil.ReadJSON(t, resp, &listB)
	assert.Equal(t, 1, listB.TotalCount)
	assert.Len(t, listB.Data, 1)
	assert.Equal(t, "B-01", listB.Data[0].Code)
}

func TestCreateBay_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-create-bay", "starter")
	userID := env.CreateUser(t, tenantID, "op-bay@test.com", "Password1!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")

	body := map[string]interface{}{
		"code": "A-01",
		"zone": "A",
	}

	resp := env.DoRequest(t, http.MethodPost, "/bays", token, body)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var created createBayResponse
	testutil.ReadJSON(t, resp, &created)
	assert.NotEqual(t, uuid.Nil, created.ID)
	assert.Equal(t, "A-01", created.Code)
	assert.Equal(t, "free", created.Status)
}

func TestCreateBay_DuplicateCode_409(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-dup-bay", "starter")
	userID := env.CreateUser(t, tenantID, "op-dup-bay@test.com", "Password1!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")

	body := map[string]interface{}{
		"code": "A-01",
		"zone": "A",
	}

	// First creation should succeed
	resp := env.DoRequest(t, http.MethodPost, "/bays", token, body)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	// Second creation with same code should fail with 409
	resp = env.DoRequest(t, http.MethodPost, "/bays", token, body)
	defer resp.Body.Close()
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var errResp map[string]interface{}
	testutil.ReadJSON(t, resp, &errResp)
	assert.Equal(t, "conflict", errResp["error"])
}

func TestUpdateBay_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-upd-bay", "starter")
	userID := env.CreateUser(t, tenantID, "op-upd-bay@test.com", "Password1!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")

	bayID := env.CreateBay(t, tenantID, "B-01")

	body := map[string]interface{}{
		"description": "Updated",
	}

	resp := env.DoRequest(t, http.MethodPatch, "/bays/"+bayID.String(), token, body)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var updated updateBayResponse
	testutil.ReadJSON(t, resp, &updated)
	assert.Equal(t, bayID, updated.ID)
	require.NotNil(t, updated.Description)
	assert.Equal(t, "Updated", *updated.Description)
}

func TestDeleteBay_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-del-bay", "starter")
	userID := env.CreateUser(t, tenantID, "op-del-bay@test.com", "Password1!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")

	bayID := env.CreateBay(t, tenantID, "C-01")

	resp := env.DoRequest(t, http.MethodDelete, "/bays/"+bayID.String(), token, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusNoContent, resp.StatusCode)

	// Verify the bay is gone
	resp = env.DoRequest(t, http.MethodGet, "/bays/"+bayID.String(), token, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}
