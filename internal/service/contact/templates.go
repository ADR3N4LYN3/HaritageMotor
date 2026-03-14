package contact

import (
	"fmt"
	"html"
)

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
		Fleet:    "Flottengröße", //nolint:misspell // German text
		Message:  "Nachricht",
		Response: "Wir antworten in der Regel innerhalb von 24 Stunden.",
		Footer:   "Heritage Motor — Fahrzeugverwaltungsplattform",
	},
}

func notificationHTML(req Request) string {
	company := req.Company
	if company == "" {
		company = "N/A"
	}
	vehicles := req.Vehicles
	if vehicles == "" {
		vehicles = "N/A"
	}

	name := html.EscapeString(req.Name)
	email := html.EscapeString(req.Email)
	companyEsc := html.EscapeString(company)
	vehiclesEsc := html.EscapeString(vehicles)
	message := html.EscapeString(req.Message)

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0908;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#0a0908;padding:0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0a0908;">

  <!-- Top spacer -->
  <tr><td style="height:48px;"></td></tr>

  <!-- Logo -->
  <tr><td align="center" style="padding:0 0 14px;">
    <img src="https://heritagemotor.app/logo-crest-v2.png" alt="HM" width="72" height="72" style="display:block;width:72px;height:72px;" />
  </td></tr>

  <!-- Brand name -->
  <tr><td align="center" style="padding:0 0 0;">
    <p style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman','Palatino Linotype',serif;font-size:13px;color:#b8955a;letter-spacing:5px;text-transform:uppercase;font-weight:normal;">Heritage Motor</p>
  </td></tr>

  <!-- Gold accent line -->
  <tr><td align="center" style="padding:24px 0 0;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="width:40px;height:1px;background:linear-gradient(to right, transparent, #b8955a40);font-size:0;">&nbsp;</td>
      <td style="width:6px;height:6px;font-size:0;padding:0 8px;"><table cellpadding="0" cellspacing="0"><tr><td style="width:6px;height:6px;background:#b8955a;transform:rotate(45deg);font-size:0;opacity:0.4;">&nbsp;</td></tr></table></td>
      <td style="width:40px;height:1px;background:linear-gradient(to left, transparent, #b8955a40);font-size:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <!-- Title -->
  <tr><td style="padding:36px 56px 0;">
    <p style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman','Palatino Linotype',serif;font-size:20px;color:#faf9f7;font-weight:normal;line-height:1.5;">New Demo Request</p>
  </td></tr>

  <!-- Spacer -->
  <tr><td style="height:28px;"></td></tr>

  <!-- Detail card -->
  <tr><td style="padding:0 40px;">
    <table width="100%%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#12110e;border:1px solid #b8955a18;border-radius:4px;">
      <!-- Card header -->
      <tr><td style="padding:20px 28px 16px;border-bottom:1px solid #b8955a12;">
        <p style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman','Palatino Linotype',serif;font-size:10px;color:#b8955a;letter-spacing:3px;text-transform:uppercase;">Contact Details</p>
      </td></tr>
      <!-- Name -->
      <tr><td style="padding:0 28px;">
        <table width="100%%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#5a564e;letter-spacing:1px;text-transform:uppercase;width:130px;">Name</td>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#e8e6e1;">%s</td>
        </tr></table>
      </td></tr>
      <!-- Email -->
      <tr><td style="padding:0 28px;">
        <table width="100%%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#5a564e;letter-spacing:1px;text-transform:uppercase;width:130px;">Email</td>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#e8e6e1;"><a href="mailto:%s" style="color:#b8955a;text-decoration:none;">%s</a></td>
        </tr></table>
      </td></tr>
      <!-- Company -->
      <tr><td style="padding:0 28px;">
        <table width="100%%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#5a564e;letter-spacing:1px;text-transform:uppercase;width:130px;">Company</td>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#e8e6e1;">%s</td>
        </tr></table>
      </td></tr>
      <!-- Fleet -->
      <tr><td style="padding:0 28px;">
        <table width="100%%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#5a564e;letter-spacing:1px;text-transform:uppercase;width:130px;">Fleet size</td>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#e8e6e1;">%s</td>
        </tr></table>
      </td></tr>
      <!-- Message -->
      <tr><td style="padding:0 28px;">
        <table width="100%%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:16px 0 15px;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#5a564e;letter-spacing:1px;text-transform:uppercase;width:130px;vertical-align:top;">Message</td>
          <td style="padding:16px 0 15px;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#e8e6e1;line-height:1.6;">%s</td>
        </tr></table>
      </td></tr>
      <!-- Card bottom padding -->
      <tr><td style="height:4px;"></td></tr>
    </table>
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
    <p style="margin:0 0 6px;font-family:'Cormorant Garamond',Georgia,'Times New Roman','Palatino Linotype',serif;font-size:10px;color:#3a3730;letter-spacing:3px;text-transform:uppercase;">Heritage Motor — Admin Notification</p>
    <p style="margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;color:#2a2722;">heritagemotor.app</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`,
		name, email, email, companyEsc, vehiclesEsc, message,
	)
}

func confirmationHTML(req Request) string {
	t, ok := translations[req.Lang]
	if !ok {
		t = translations["en"]
	}

	company := req.Company
	if company == "" {
		company = "—"
	}
	vehicles := req.Vehicles
	if vehicles == "" {
		vehicles = "—"
	}
	message := req.Message
	if message == "" {
		message = "—"
	}

	company = html.EscapeString(company)
	vehicles = html.EscapeString(vehicles)
	message = html.EscapeString(message)
	greeting := fmt.Sprintf(t.Greeting, html.EscapeString(req.Name))

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="%s">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0908;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#0a0908;padding:0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0a0908;">

  <!-- Top spacer -->
  <tr><td style="height:48px;"></td></tr>

  <!-- Logo (shield only) -->
  <tr><td align="center" style="padding:0 0 14px;">
    <img src="https://heritagemotor.app/logo-crest-v2.png" alt="HM" width="72" height="72" style="display:block;width:72px;height:72px;" />
  </td></tr>

  <!-- Brand name -->
  <tr><td align="center" style="padding:0 0 0;">
    <p style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman','Palatino Linotype',serif;font-size:13px;color:#b8955a;letter-spacing:5px;text-transform:uppercase;font-weight:normal;">Heritage Motor</p>
  </td></tr>

  <!-- Gold accent line -->
  <tr><td align="center" style="padding:24px 0 0;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="width:40px;height:1px;background:linear-gradient(to right, transparent, #b8955a40);font-size:0;">&nbsp;</td>
      <td style="width:6px;height:6px;font-size:0;padding:0 8px;"><table cellpadding="0" cellspacing="0"><tr><td style="width:6px;height:6px;background:#b8955a;transform:rotate(45deg);font-size:0;opacity:0.4;">&nbsp;</td></tr></table></td>
      <td style="width:40px;height:1px;background:linear-gradient(to left, transparent, #b8955a40);font-size:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:36px 56px 0;">
    <p style="margin:0 0 24px;font-family:'Cormorant Garamond',Georgia,'Times New Roman','Palatino Linotype',serif;font-size:20px;color:#faf9f7;font-weight:normal;line-height:1.5;">%s</p>
    <p style="margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;color:#8a867e;line-height:1.8;">%s</p>
  </td></tr>

  <!-- Spacer -->
  <tr><td style="height:36px;"></td></tr>

  <!-- Summary card -->
  <tr><td style="padding:0 40px;">
    <table width="100%%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#12110e;border:1px solid #b8955a18;border-radius:4px;">
      <!-- Card header -->
      <tr><td style="padding:20px 28px 16px;border-bottom:1px solid #b8955a12;">
        <p style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman','Palatino Linotype',serif;font-size:10px;color:#b8955a;letter-spacing:3px;text-transform:uppercase;">%s</p>
      </td></tr>
      <!-- Row 1 -->
      <tr><td style="padding:0 28px;">
        <table width="100%%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#5a564e;letter-spacing:1px;text-transform:uppercase;width:130px;">%s</td>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#e8e6e1;">%s</td>
        </tr></table>
      </td></tr>
      <!-- Row 2 -->
      <tr><td style="padding:0 28px;">
        <table width="100%%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#5a564e;letter-spacing:1px;text-transform:uppercase;width:130px;">%s</td>
          <td style="padding:16px 0 15px;border-bottom:1px solid #ffffff06;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#e8e6e1;">%s</td>
        </tr></table>
      </td></tr>
      <!-- Row 3 -->
      <tr><td style="padding:0 28px;">
        <table width="100%%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:16px 0 15px;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#5a564e;letter-spacing:1px;text-transform:uppercase;width:130px;vertical-align:top;">%s</td>
          <td style="padding:16px 0 15px;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#e8e6e1;line-height:1.6;">%s</td>
        </tr></table>
      </td></tr>
      <!-- Card bottom padding -->
      <tr><td style="height:4px;"></td></tr>
    </table>
  </td></tr>

  <!-- Response time -->
  <tr><td style="padding:32px 56px 0;">
    <p style="margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#5a564e;line-height:1.6;font-style:italic;">%s</p>
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
    <p style="margin:0 0 6px;font-family:'Cormorant Garamond',Georgia,'Times New Roman','Palatino Linotype',serif;font-size:10px;color:#3a3730;letter-spacing:3px;text-transform:uppercase;">%s</p>
    <p style="margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;color:#2a2722;">heritagemotor.app</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`,
		req.Lang,
		greeting,
		t.Body,
		t.Summary,
		t.Company, company,
		t.Fleet, vehicles,
		t.Message, message,
		t.Response,
		t.Footer,
	)
}
