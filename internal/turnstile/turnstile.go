package turnstile

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

const verifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// Verifier validates Cloudflare Turnstile tokens.
type Verifier struct {
	secret     string
	httpClient *http.Client
}

// NewVerifier creates a Turnstile verifier. If secret is empty, verification is skipped (dev mode).
func NewVerifier(secret string) *Verifier {
	return &Verifier{
		secret:     secret,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Enabled returns true if Turnstile verification is configured.
func (v *Verifier) Enabled() bool {
	return v.secret != ""
}

// Verify validates a Turnstile response token. Returns nil if verification succeeds or is not configured.
func (v *Verifier) Verify(ctx context.Context, token, ip string) error {
	if v.secret == "" {
		return nil // dev mode — skip verification
	}

	if token == "" {
		return fmt.Errorf("turnstile token missing")
	}

	payload := map[string]string{
		"secret":   v.secret,
		"response": token,
		"remoteip": ip,
	}
	body, _ := json.Marshal(payload) //nolint:errcheck // static map

	req, err := http.NewRequestWithContext(ctx, "POST", verifyURL, bytes.NewReader(body))
	if err != nil {
		log.Error().Err(err).Msg("turnstile: failed to create verify request — failing open")
		return nil // fail-open on internal error
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := v.httpClient.Do(req)
	if err != nil {
		log.Warn().Err(err).Str("ip", ip).Msg("turnstile: verification request failed — failing open, monitor for abuse")
		return nil // fail-open on network error
	}
	defer resp.Body.Close() //nolint:errcheck // HTTP cleanup

	var result struct {
		Success bool `json:"success"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Warn().Err(err).Str("ip", ip).Msg("turnstile: response decode failed — failing open, monitor for abuse")
		return nil // fail-open on decode error
	}

	if !result.Success {
		log.Warn().Str("ip", ip).Msg("turnstile verification failed — bot suspected") //nolint:misspell // em dash
		return fmt.Errorf("turnstile verification failed")
	}

	return nil
}
