package contact

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/chriis/heritage-motor/internal/turnstile"
)

type Service struct {
	pool         *pgxpool.Pool
	resendAPIKey string
	emailFrom    string
	emailTo      string
	httpClient   *http.Client
	turnstile    *turnstile.Verifier
}

func NewService(pool *pgxpool.Pool, resendAPIKey, emailFrom, emailTo string, tv *turnstile.Verifier) *Service {
	return &Service{
		pool:         pool,
		resendAPIKey: resendAPIKey,
		emailFrom:    emailFrom,
		emailTo:      emailTo,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
		turnstile:    tv,
	}
}

type Request struct {
	Name              string
	Email             string
	Company           string
	Vehicles          string
	Message           string
	IP                string
	Lang              string
	TurnstileResponse string
}

func (s *Service) Submit(ctx context.Context, req Request) error {
	// Verify Turnstile token (skip if not configured — dev mode)
	if err := s.turnstile.Verify(ctx, req.TurnstileResponse, req.IP); err != nil {
		return err
	}

	// Store in DB
	_, err := s.pool.Exec(ctx,
		`INSERT INTO contact_requests (name, email, company, vehicles, message, ip_address)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		req.Name, req.Email, req.Company, req.Vehicles, req.Message, req.IP,
	)
	if err != nil {
		return fmt.Errorf("insert contact request: %w", err)
	}

	// Send emails (best-effort, don't fail the request)
	if s.resendAPIKey != "" {
		go s.sendNotification(req)
		go s.sendConfirmation(req)
	}

	return nil
}

func (s *Service) sendNotification(req Request) {
	htmlBody := notificationHTML(req)

	payload := map[string]interface{}{
		"from":    s.emailFrom,
		"to":      []string{s.emailTo},
		"subject": fmt.Sprintf("Heritage Motor — Demo Request from %s", req.Name),
		"html":    htmlBody,
	}

	s.sendEmail(payload, "contact notification", map[string]string{
		"to":           s.emailTo,
		"from_contact": req.Email,
	})
}

func (s *Service) sendConfirmation(req Request) {
	t, ok := translations[req.Lang]
	if !ok {
		t = translations["en"]
	}

	htmlBody := confirmationHTML(req)
	welcomeFrom := strings.Replace(s.emailFrom, "noreply@", "welcome@", 1)

	payload := map[string]interface{}{
		"from":    welcomeFrom,
		"to":      []string{req.Email},
		"subject": t.Subject,
		"html":    htmlBody,
	}

	s.sendEmail(payload, "confirmation", map[string]string{
		"to":   req.Email,
		"lang": req.Lang,
	})
}

func (s *Service) sendEmail(payload map[string]interface{}, emailType string, logFields map[string]string) {
	body, err := json.Marshal(payload)
	if err != nil {
		log.Error().Err(err).Msgf("failed to marshal %s email payload", emailType)
		return
	}

	httpReq, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		log.Error().Err(err).Msgf("failed to create %s email request", emailType)
		return
	}
	httpReq.Header.Set("Authorization", "Bearer "+s.resendAPIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		log.Error().Err(err).Msgf("failed to send %s email", emailType)
		return
	}
	defer resp.Body.Close() //nolint:errcheck // HTTP cleanup

	if resp.StatusCode >= 400 {
		log.Error().Int("status", resp.StatusCode).Msgf("resend API returned error for %s email", emailType)
	} else {
		event := log.Info()
		for k, v := range logFields {
			event = event.Str(k, v)
		}
		event.Msgf("%s email sent", emailType)
	}
}
