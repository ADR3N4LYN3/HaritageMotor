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
	Lang     string
}

type emailStrings struct {
	Subject  string
	Greeting string
	Body     string
	Summary  string
	Company  string
	Fleet    string
	Message  string
	Response string
	Footer   string
}

var translations = map[string]emailStrings{
	"en": {
		Subject:  "Heritage Motor — We have received your request",
		Greeting: "Dear %s,",
		Body:     "Thank you for your interest in Heritage Motor. We have received your demo request and our team will be in touch shortly.",
		Summary:  "Summary of your enquiry",
		Company:  "Company",
		Fleet:    "Fleet size",
		Message:  "Message",
		Response: "We typically respond within 24 hours.",
		Footer:   "Heritage Motor — Vehicle Custody Platform",
	},
	"fr": {
		Subject:  "Heritage Motor — Nous avons bien reçu votre demande",
		Greeting: "Cher %s,",
		Body:     "Merci pour votre intérêt pour Heritage Motor. Nous avons bien reçu votre demande de démonstration et notre équipe reviendra vers vous dans les plus brefs délais.",
		Summary:  "Récapitulatif de votre demande",
		Company:  "Société",
		Fleet:    "Taille de flotte",
		Message:  "Message",
		Response: "Nous répondons généralement sous 24 heures.",
		Footer:   "Heritage Motor — Plateforme de Garde de Véhicules",
	},
	"de": {
		Subject:  "Heritage Motor — Wir haben Ihre Anfrage erhalten",
		Greeting: "Sehr geehrte/r %s,",
		Body:     "Vielen Dank für Ihr Interesse an Heritage Motor. Wir haben Ihre Demo-Anfrage erhalten und unser Team wird sich in Kürze bei Ihnen melden.",
		Summary:  "Zusammenfassung Ihrer Anfrage",
		Company:  "Unternehmen",
		Fleet:    "Flottengröße",
		Message:  "Nachricht",
		Response: "Wir antworten in der Regel innerhalb von 24 Stunden.",
		Footer:   "Heritage Motor — Fahrzeugverwaltungsplattform",
	},
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

	// Send emails (best-effort, don't fail the request)
	if s.resendAPIKey != "" {
		go s.sendNotification(req)
		go s.sendConfirmation(req)
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
	} else {
		log.Info().Str("to", s.emailTo).Str("from_contact", req.Email).Msg("contact notification email sent")
	}
}

func (s *Service) sendConfirmation(req Request) {
	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8f7f5;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#f8f7f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="background:#0e0d0b;padding:32px 40px;text-align:center;">
    <h1 style="margin:0;font-size:24px;color:#b8955a;letter-spacing:2px;">Heritage Motor</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="margin:0 0 20px;font-size:16px;color:#333;">Dear %s,</p>
    <p style="margin:0 0 20px;font-size:16px;color:#333;line-height:1.6;">
      Thank you for your interest in Heritage Motor. We have received your demo request and our team will get back to you shortly.
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#666;">Here is a summary of your request:</p>
    <table style="width:100%%;border-collapse:collapse;margin:16px 0 24px;">
      <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#999;font-size:13px;">Company</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#333;font-size:14px;">%s</td></tr>
      <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#999;font-size:13px;">Fleet size</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#333;font-size:14px;">%s</td></tr>
      <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#999;font-size:13px;">Message</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#333;font-size:14px;">%s</td></tr>
    </table>
    <p style="margin:0;font-size:16px;color:#333;line-height:1.6;">
      We typically respond within 24 hours.
    </p>
  </td></tr>
  <tr><td style="background:#faf9f7;padding:24px 40px;text-align:center;border-top:1px solid #eee;">
    <p style="margin:0;font-size:12px;color:#999;">Heritage Motor — Vehicle Custody Platform</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
		req.Name,
		func() string { if req.Company != "" { return req.Company }; return "—" }(),
		func() string { if req.Vehicles != "" { return req.Vehicles }; return "—" }(),
		func() string { if req.Message != "" { return req.Message }; return "—" }(),
	)

	// Use welcome@ instead of noreply@ for confirmation emails
	welcomeFrom := strings.Replace(s.emailFrom, "noreply@", "welcome@", 1)

	payload := map[string]interface{}{
		"from":    welcomeFrom,
		"to":      []string{req.Email},
		"subject": "Heritage Motor — We received your request",
		"html":    htmlBody,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Error().Err(err).Msg("failed to marshal confirmation email payload")
		return
	}

	httpReq, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		log.Error().Err(err).Msg("failed to create confirmation email request")
		return
	}
	httpReq.Header.Set("Authorization", "Bearer "+s.resendAPIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		log.Error().Err(err).Msg("failed to send confirmation email")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Error().Int("status", resp.StatusCode).Msg("resend API returned error for confirmation email")
	} else {
		log.Info().Str("to", req.Email).Msg("confirmation email sent")
	}
}
