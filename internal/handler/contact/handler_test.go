package contact_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/chriis/heritage-motor/internal/testutil"
)

// ---------- Contact Submit ----------

func TestContact_ValidSubmission(t *testing.T) {
	env := testutil.Setup(t)

	resp := env.DoRequest(t, http.MethodPost, "/contact", "", map[string]string{
		"name":    "Jean Dupont",
		"email":   "jean@example.com",
		"company": "Prestige Cars SA",
		"message": "I would like a demo please.",
		"lang":    "fr",
	})
	defer resp.Body.Close()

	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var body map[string]interface{}
	testutil.ReadJSON(t, resp, &body)
	assert.Equal(t, "request received", body["message"])
}

func TestContact_MissingName(t *testing.T) {
	env := testutil.Setup(t)

	resp := env.DoRequest(t, http.MethodPost, "/contact", "", map[string]string{
		"email":   "noname@example.com",
		"message": "Hello",
	})
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)

	var body map[string]interface{}
	testutil.ReadJSON(t, resp, &body)
	assert.Equal(t, "validation", body["error"])
}

func TestContact_MissingEmail(t *testing.T) {
	env := testutil.Setup(t)

	resp := env.DoRequest(t, http.MethodPost, "/contact", "", map[string]string{
		"name":    "Jean Dupont",
		"message": "Hello",
	})
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)

	var body map[string]interface{}
	testutil.ReadJSON(t, resp, &body)
	assert.Equal(t, "validation", body["error"])
}

func TestContact_InvalidEmailFormat(t *testing.T) {
	env := testutil.Setup(t)

	resp := env.DoRequest(t, http.MethodPost, "/contact", "", map[string]string{
		"name":  "Jean Dupont",
		"email": "not-an-email",
	})
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)

	var body map[string]interface{}
	testutil.ReadJSON(t, resp, &body)
	assert.Equal(t, "validation", body["error"])
}

func TestContact_HoneypotFilled(t *testing.T) {
	env := testutil.Setup(t)

	// When the honeypot "website" field is filled, the handler returns 201
	// (fake success) without actually saving the request.
	resp := env.DoRequest(t, http.MethodPost, "/contact", "", map[string]string{
		"name":    "Bot McBotface",
		"email":   "bot@spam.com",
		"website": "http://spam.com",
		"message": "Buy cheap watches",
	})
	defer resp.Body.Close()

	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var body map[string]interface{}
	testutil.ReadJSON(t, resp, &body)
	assert.Equal(t, "request received", body["message"])
}

func TestContact_MinimalValid(t *testing.T) {
	env := testutil.Setup(t)

	// Only required fields: name (min 2 chars) and email
	resp := env.DoRequest(t, http.MethodPost, "/contact", "", map[string]string{
		"name":  "AB",
		"email": "minimal@example.com",
	})
	defer resp.Body.Close()

	require.Equal(t, http.StatusCreated, resp.StatusCode)
}

func TestContact_NameTooShort(t *testing.T) {
	env := testutil.Setup(t)

	// Name must be min=2
	resp := env.DoRequest(t, http.MethodPost, "/contact", "", map[string]string{
		"name":  "A",
		"email": "short@example.com",
	})
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
}
