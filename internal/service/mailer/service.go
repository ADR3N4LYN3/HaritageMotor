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

type welcomeStrings struct {
	Subject    string
	Greeting   string
	Body       string
	CardHeader string
	Password   string
	Button     string
	Note       string
	Footer     string
}

var welcomeTranslations = map[string]welcomeStrings{
	"fr": {
		Subject:    "Heritage Motor — Bienvenue chez %s",
		Greeting:   "Bienvenue %s,",
		Body:       "Votre compte a été créé sur la plateforme Heritage Motor pour <span style=\"color:#b8955a;\">%s</span>. Vous trouverez ci-dessous vos identifiants de connexion.", //nolint:misspell // French text
		CardHeader: "Vos identifiants",
		Password:   "Mot de passe",
		Button:     "Se connecter",
		Note:       "Vous devrez changer votre mot de passe lors de votre première connexion.", //nolint:misspell // French text
		Footer:     "Heritage Motor — Plateforme de Garde de Véhicules",
	},
	"en": {
		Subject:    "Heritage Motor — Welcome to %s",
		Greeting:   "Welcome %s,",
		Body:       "Your account has been created on the Heritage Motor platform for <span style=\"color:#b8955a;\">%s</span>. Please find your login credentials below.",
		CardHeader: "Your credentials",
		Password:   "Password",
		Button:     "Sign in",
		Note:       "You will need to change your password on your first login.",
		Footer:     "Heritage Motor — Vehicle Custody Platform",
	},
	"de": {
		Subject:    "Heritage Motor — Willkommen bei %s",
		Greeting:   "Willkommen %s,",
		Body:       "Ihr Konto wurde auf der Heritage Motor Plattform für <span style=\"color:#b8955a;\">%s</span> erstellt. Nachfolgend finden Sie Ihre Zugangsdaten.",
		CardHeader: "Ihre Zugangsdaten",
		Password:   "Passwort",
		Button:     "Anmelden",
		Note:       "Sie müssen Ihr Passwort bei der ersten Anmeldung ändern.",
		Footer:     "Heritage Motor — Fahrzeugverwaltungsplattform",
	},
}

// SendWelcome sends a welcome email with temporary credentials.
func (s *Service) SendWelcome(to, firstName, tenantName, tempPassword, lang string) error {
	t, ok := welcomeTranslations[lang]
	if !ok {
		t = welcomeTranslations["fr"]
	}

	subject := fmt.Sprintf(t.Subject, tenantName)
	greeting := fmt.Sprintf(t.Greeting, firstName)
	body := fmt.Sprintf(t.Body, tenantName)

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="%s">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0908;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#0a0908;padding:0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0a0908;">

  <!-- Top spacer -->
  <tr><td style="height:48px;"></td></tr>

  <!-- Logo -->
  <tr><td align="center" style="padding:0 0 14px;">
    <img src="https://heritagemotor.app/logo-email.png" alt="HM" width="72" height="88" style="display:block;width:72px;height:88px;" />
  </td></tr>

  <!-- Brand name -->
  <tr><td align="center" style="padding:0 0 0;">
    <p style="margin:0;font-family:Georgia,'Times New Roman','Palatino Linotype',serif;font-size:13px;color:#b8955a;letter-spacing:5px;text-transform:uppercase;font-weight:normal;">Heritage Motor</p>
  </td></tr>

  <!-- Gold accent line -->
  <tr><td align="center" style="padding:24px 0 0;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="width:40px;height:1px;background:linear-gradient(to right, transparent, #b8955a40);font-size:0;">&nbsp;</td>
      <td style="width:6px;height:6px;font-size:0;padding:0 8px;"><table cellpadding="0" cellspacing="0"><tr><td style="width:6px;height:6px;background:#b8955a;transform:rotate(45deg);font-size:0;opacity:0.4;">&nbsp;</td></tr></table></td>
      <td style="width:40px;height:1px;background:linear-gradient(to left, transparent, #b8955a40);font-size:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:36px 56px 0;">
    <p style="margin:0 0 24px;font-family:Georgia,'Times New Roman','Palatino Linotype',serif;font-size:20px;color:#faf9f7;font-weight:normal;line-height:1.5;">%s</p>
    <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;color:#8a867e;line-height:1.8;">%s</p>
  </td></tr>

  <!-- Spacer -->
  <tr><td style="height:28px;"></td></tr>

  <!-- Credentials card -->
  <tr><td style="padding:0 40px;">
    <table width="100%%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#12110e;border:1px solid #b8955a18;border-radius:4px;">
      <!-- Card header -->
      <tr><td style="padding:20px 28px 16px;border-bottom:1px solid #b8955a12;">
        <p style="margin:0;font-family:Georgia,'Times New Roman','Palatino Linotype',serif;font-size:10px;color:#b8955a;letter-spacing:3px;text-transform:uppercase;">%s</p>
      </td></tr>
      <!-- Email -->
      <tr><td style="padding:0 28px;">
        <table width="100%%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#5a564e;letter-spacing:1px;text-transform:uppercase;width:130px;">Email</td>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#e8e6e1;">%s</td>
        </tr></table>
      </td></tr>
      <!-- Password -->
      <tr><td style="padding:0 28px;">
        <table width="100%%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:16px 0 15px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#5a564e;letter-spacing:1px;text-transform:uppercase;width:130px;">%s</td>
          <td style="padding:16px 0 15px;font-family:'Courier New',Courier,monospace;font-size:15px;color:#b8955a;letter-spacing:1px;">%s</td>
        </tr></table>
      </td></tr>
      <!-- Card bottom padding -->
      <tr><td style="height:4px;"></td></tr>
    </table>
  </td></tr>

  <!-- CTA Button -->
  <tr><td align="center" style="padding:32px 40px 0;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background:#b8955a;border-radius:4px;padding:14px 36px;">
        <a href="%s/login" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#0a0908;text-decoration:none;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">%s</a>
      </td>
    </tr></table>
  </td></tr>

  <!-- Note -->
  <tr><td style="padding:28px 56px 0;">
    <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#5a564e;line-height:1.6;font-style:italic;">%s</p>
  </td></tr>

  <!-- Bottom spacer -->
  <tr><td style="height:48px;"></td></tr>

  <!-- Footer divider -->
  <tr><td style="padding:0 56px;">
    <table width="100%%" cellpadding="0" cellspacing="0"><tr>
      <td style="border-bottom:1px solid #b8955a10;font-size:0;height:1px;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <!-- Footer -->
  <tr><td align="center" style="padding:24px 56px 48px;">
    <p style="margin:0 0 6px;font-family:Georgia,'Times New Roman','Palatino Linotype',serif;font-size:10px;color:#3a3730;letter-spacing:3px;text-transform:uppercase;">%s</p>
    <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;color:#2a2722;">heritagemotor.app</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`,
		lang,
		greeting,
		body,
		t.CardHeader,
		to,
		t.Password, tempPassword,
		s.baseURL, t.Button,
		t.Note,
		t.Footer,
	)

	return s.send(to, subject, html)
}
