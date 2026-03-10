package document_test

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/chriis/heritage-motor/internal/testutil"
)

type docResp struct {
	ID        string `json:"id"`
	VehicleID string `json:"vehicle_id"`
	DocType   string `json:"doc_type"`
	Filename  string `json:"filename"`
	MimeType  string `json:"mime_type"`
	SizeBytes int64  `json:"size_bytes"`
}

type docListResp struct {
	Data       []docResp `json:"data"`
	TotalCount int       `json:"total_count"`
	Page       int       `json:"page"`
	PerPage    int       `json:"per_page"`
}

// validPDF is a minimal byte sequence with the %PDF magic header so that
// mimetype.DetectReader recognizes it as application/pdf.
var validPDF = []byte("%PDF-1.4 fake pdf content for testing")

// doMultipart creates a multipart request to POST /vehicles/:id/documents.
func doMultipart(t *testing.T, env *testutil.Env, vehicleID uuid.UUID, token, docType, filename, mimeType string, fileContent []byte) *http.Response {
	t.Helper()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// doc_type field
	err := writer.WriteField("doc_type", docType)
	require.NoError(t, err)

	// file field
	part, err := writer.CreateFormFile("file", filename)
	require.NoError(t, err)
	_, err = part.Write(fileContent)
	require.NoError(t, err)

	err = writer.Close()
	require.NoError(t, err)

	path := fmt.Sprintf("/api/v1/vehicles/%s/documents", vehicleID)
	req, err := http.NewRequest(http.MethodPost, path, &buf)
	require.NoError(t, err)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := env.App.Test(req, -1)
	require.NoError(t, err)
	return resp
}

// ---------- List ----------

func TestListDocuments_Empty(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "doc-list-empty", "starter")
	userID := env.CreateUser(t, tenantID, "doc-list@test.com", "P@ssw0rd!!", "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")
	vehicleID := env.CreateVehicle(t, tenantID, "Ferrari", "488", "Owner Doc")

	resp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/vehicles/%s/documents", vehicleID), token, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body docListResp
	testutil.ReadJSON(t, resp, &body)
	assert.Equal(t, 0, body.TotalCount)
	assert.Empty(t, body.Data)
}

// ---------- Create ----------

func TestCreateDocument_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "doc-create", "starter")
	userID := env.CreateUser(t, tenantID, "doc-create@test.com", "P@ssw0rd!!", "technician")
	token := env.AuthToken(t, userID, tenantID, "technician")
	vehicleID := env.CreateVehicle(t, tenantID, "Porsche", "911", "Owner Doc")

	resp := doMultipart(t, env, vehicleID, token, "insurance", "policy.pdf", "application/pdf", validPDF)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var doc docResp
	testutil.ReadJSON(t, resp, &doc)
	assert.NotEmpty(t, doc.ID)
	assert.Equal(t, vehicleID.String(), doc.VehicleID)
	assert.Equal(t, "insurance", doc.DocType)
	assert.Equal(t, "policy.pdf", doc.Filename)
	assert.Equal(t, "application/pdf", doc.MimeType)
	assert.Equal(t, int64(len(validPDF)), doc.SizeBytes)
}

func TestCreateDocument_ViewerForbidden(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "doc-viewer-forbid", "starter")
	userID := env.CreateUser(t, tenantID, "doc-viewer@test.com", "P@ssw0rd!!", "viewer")
	token := env.AuthToken(t, userID, tenantID, "viewer")
	vehicleID := env.CreateVehicle(t, tenantID, "BMW", "M3", "Owner")

	resp := doMultipart(t, env, vehicleID, token, "insurance", "policy.pdf", "application/pdf", validPDF)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestCreateDocument_InvalidDocType(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "doc-bad-type", "starter")
	userID := env.CreateUser(t, tenantID, "doc-badtype@test.com", "P@ssw0rd!!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")
	vehicleID := env.CreateVehicle(t, tenantID, "Audi", "R8", "Owner")

	resp := doMultipart(t, env, vehicleID, token, "nonexistent_type", "file.pdf", "application/pdf", validPDF)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
}

// ---------- Delete ----------

func TestDeleteDocument_AdminOnly(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "doc-delete", "starter")
	techID := env.CreateUser(t, tenantID, "doc-tech@test.com", "P@ssw0rd!!", "technician")
	adminID := env.CreateUser(t, tenantID, "doc-admin@test.com", "P@ssw0rd!!", "admin")
	techToken := env.AuthToken(t, techID, tenantID, "technician")
	adminToken := env.AuthToken(t, adminID, tenantID, "admin")
	vehicleID := env.CreateVehicle(t, tenantID, "Mercedes", "SLS", "Owner")

	// Create a document as technician
	createResp := doMultipart(t, env, vehicleID, techToken, "storage_contract", "contract.pdf", "application/pdf", validPDF)
	defer createResp.Body.Close()
	require.Equal(t, http.StatusCreated, createResp.StatusCode)

	var doc docResp
	testutil.ReadJSON(t, createResp, &doc)

	// Technician cannot delete
	resp := env.DoRequest(t, http.MethodDelete, fmt.Sprintf("/vehicles/%s/documents/%s", vehicleID, doc.ID), techToken, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)

	// Admin can delete
	resp = env.DoRequest(t, http.MethodDelete, fmt.Sprintf("/vehicles/%s/documents/%s", vehicleID, doc.ID), adminToken, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
}

// ---------- Cross-tenant ----------

func TestListDocuments_CrossTenant_Empty(t *testing.T) {
	env := testutil.Setup(t)

	tenantA, _ := env.CreateTenant(t, "doc-cross-a", "starter")
	userA := env.CreateUser(t, tenantA, "doc-cross-a@test.com", "P@ssw0rd!!", "technician")
	tokenA := env.AuthToken(t, userA, tenantA, "technician")
	vehicleA := env.CreateVehicle(t, tenantA, "Ferrari", "LaFerrari", "Owner A")

	tenantB, _ := env.CreateTenant(t, "doc-cross-b", "starter")
	userB := env.CreateUser(t, tenantB, "doc-cross-b@test.com", "P@ssw0rd!!", "admin")
	tokenB := env.AuthToken(t, userB, tenantB, "admin")

	// Create doc in tenant A
	createResp := doMultipart(t, env, vehicleA, tokenA, "insurance", "policy.pdf", "application/pdf", validPDF)
	defer createResp.Body.Close()
	require.Equal(t, http.StatusCreated, createResp.StatusCode)

	// Tenant B tries to list docs for tenant A's vehicle — should get 0 results (RLS)
	resp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/vehicles/%s/documents", vehicleA), tokenB, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body docListResp
	testutil.ReadJSON(t, resp, &body)
	assert.Equal(t, 0, body.TotalCount)
}
