package mailer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

// Service sends emails via the Resend API.
type Service struct {
	apiKey  string
	from    string
	baseURL string
	client  *http.Client
}

func NewService(apiKey, from, baseURL string) *Service {
	return &Service{
		apiKey:  apiKey,
		from:    from,
		baseURL: baseURL,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

type sendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

func (s *Service) send(to, subject, html string) error {
	if s.apiKey == "" {
		log.Warn().Str("to", to).Str("subject", subject).Msg("mailer: no API key, skipping email")
		return nil
	}

	body, _ := json.Marshal(sendRequest{
		From:    s.from,
		To:      []string{to},
		Subject: subject,
		HTML:    html,
	})

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("send email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("resend API returned %d", resp.StatusCode)
	}

	log.Info().Str("to", to).Str("subject", subject).Msg("email sent")
	return nil
}

// SendWelcome sends a welcome email with temporary credentials.
func (s *Service) SendWelcome(to, firstName, tenantName, tempPassword string) error {
	subject := fmt.Sprintf("Bienvenue sur Heritage Motor — %s", tenantName)
	html := fmt.Sprintf(`
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <h2>Bienvenue %s !</h2>
  <p>Votre compte a été créé sur la plateforme Heritage Motor pour <strong>%s</strong>.</p>
  <p>Voici vos identifiants temporaires :</p>
  <table style="border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:4px 12px;font-weight:bold;">Email</td><td style="padding:4px 12px;">%s</td></tr>
    <tr><td style="padding:4px 12px;font-weight:bold;">Mot de passe</td><td style="padding:4px 12px;font-family:monospace;background:#f5f5f5;border-radius:4px;">%s</td></tr>
  </table>
  <p><a href="%s/login" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:white;text-decoration:none;border-radius:6px;">Se connecter</a></p>
  <p style="color:#666;font-size:0.9em;">Vous devrez changer votre mot de passe lors de votre première connexion.</p>
</div>`,
		firstName, tenantName, to, tempPassword, s.baseURL)

	return s.send(to, subject, html)
}
