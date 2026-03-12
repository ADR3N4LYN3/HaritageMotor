package photo_test

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/chriis/heritage-motor/internal/testutil"
)

func TestGetSignedURL_StorageNotConfigured_503(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-photo", "starter")
	userID := env.CreateUser(t, tenantID, "photo@test.com", "P@ssw0rd!!", "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")

	// Build a valid S3 key that belongs to the tenant and encode it as base64url.
	s3Key := fmt.Sprintf("%s/photos/vehicle-123/1234_photo.jpg", tenantID.String())
	encodedKey := base64.URLEncoding.EncodeToString([]byte(s3Key))

	resp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/photos/%s/signed-url", encodedKey), token, nil)
	defer resp.Body.Close()

	// S3 client is nil in tests, so we expect 503 (storage not configured).
	require.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)

	var body map[string]interface{}
	testutil.ReadJSON(t, resp, &body)
	assert.Equal(t, "storage not configured", body["error"])
}

func TestGetSignedURL_WithoutAuth_401(t *testing.T) {
	env := testutil.Setup(t)

	encodedKey := base64.URLEncoding.EncodeToString([]byte("some-tenant/photos/test.jpg"))

	resp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/photos/%s/signed-url", encodedKey), "", nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestGetSignedURL_CrossTenant_403(t *testing.T) {
	env := testutil.Setup(t)

	tenantA, _ := env.CreateTenant(t, "tenant-photo-a", "starter")
	tenantB, _ := env.CreateTenant(t, "tenant-photo-b", "starter")
	userB := env.CreateUser(t, tenantB, "photo-b@test.com", "P@ssw0rd!!", "admin")
	tokenB := env.AuthToken(t, userB, tenantB, "admin")

	// Build a key that belongs to tenant A, but authenticate as tenant B.
	s3Key := fmt.Sprintf("%s/photos/vehicle-123/photo.jpg", tenantA.String())
	encodedKey := base64.URLEncoding.EncodeToString([]byte(s3Key))

	resp := env.DoRequest(t, http.MethodGet, fmt.Sprintf("/photos/%s/signed-url", encodedKey), tokenB, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestGetSignedURL_InvalidBase64_400(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-photo-bad", "starter")
	userID := env.CreateUser(t, tenantID, "photo-bad@test.com", "P@ssw0rd!!", "admin")
	token := env.AuthToken(t, userID, tenantID, "admin")

	// Send an invalid base64 string.
	resp := env.DoRequest(t, http.MethodGet, "/photos/not-valid-base64!!!/signed-url", token, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}
