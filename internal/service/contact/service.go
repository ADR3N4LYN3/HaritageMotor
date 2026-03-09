package contact

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type Service struct {
	pool         *pgxpool.Pool
	resendAPIKey string
	emailFrom    string
	emailTo      string
	httpClient   *http.Client
}

func NewService(pool *pgxpool.Pool, resendAPIKey, emailFrom, emailTo string) *Service {
	return &Service{
		pool:         pool,
		resendAPIKey: resendAPIKey,
		emailFrom:    emailFrom,
		emailTo:      emailTo,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

type Request struct {
	Name     string
	Email    string
	Company  string
	Vehicles string
	Message  string
	IP       string
}

func (s *Service) Submit(ctx context.Context, req Request) error {
	// Store in DB
	_, err := s.pool.Exec(ctx,
		`INSERT INTO contact_requests (name, email, company, vehicles, message, ip_address)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		req.Name, req.Email, req.Company, req.Vehicles, req.Message, req.IP,
	)
	if err != nil {
		return fmt.Errorf("insert contact request: %w", err)
	}

	// Send email notification (best-effort, don't fail the request)
	if s.resendAPIKey != "" {
		go s.sendNotification(req)
	}

	return nil
}

func (s *Service) sendNotification(req Request) {
	company := req.Company
	if company == "" {
		company = "N/A"
	}
	vehicles := req.Vehicles
	if vehicles == "" {
		vehicles = "N/A"
	}

	htmlBody := fmt.Sprintf(`<h2>New Demo Request</h2>
<table style="border-collapse:collapse;font-family:sans-serif;">
<tr><td style="padding:6px 12px;font-weight:bold;">Name</td><td style="padding:6px 12px;">%s</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold;">Email</td><td style="padding:6px 12px;"><a href="mailto:%s">%s</a></td></tr>
<tr><td style="padding:6px 12px;font-weight:bold;">Company</td><td style="padding:6px 12px;">%s</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold;">Fleet size</td><td style="padding:6px 12px;">%s</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold;">Message</td><td style="padding:6px 12px;">%s</td></tr>
</table>`,
		req.Name, req.Email, req.Email, company, vehicles, req.Message,
	)

	payload := map[string]interface{}{
		"from":    s.emailFrom,
		"to":      []string{s.emailTo},
		"subject": fmt.Sprintf("Heritage Motor — Demo Request from %s", req.Name),
		"html":    htmlBody,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Error().Err(err).Msg("failed to marshal email payload")
		return
	}

	httpReq, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		log.Error().Err(err).Msg("failed to create email request")
		return
	}
	httpReq.Header.Set("Authorization", "Bearer "+s.resendAPIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		log.Error().Err(err).Msg("failed to send contact notification email")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Error().Int("status", resp.StatusCode).Msg("resend API returned error for contact notification")
	}
}
