package report

import (
	"bytes"
	"fmt"
	"math"
	"time"

	"github.com/go-pdf/fpdf"
	"github.com/google/uuid"

	"github.com/chriis/heritage-motor/internal/domain"
)

// Brand colors
const (
	goldR, goldG, goldB                      = 184, 149, 90
	darkR, darkG, darkB                      = 14, 13, 11
	headerH                                  = 56.0  // dark header band height (mm)
	logoSize                                 = 20.0  // logo in header (mm)
	pageW                                    = 210.0 // A4 width
	marginL                                  = 20.0
	marginR                                  = 20.0
	contentW                                 = pageW - marginL - marginR
	footerY                                  = 280.0
	tableHeaderR, tableHeaderG, tableHeaderB = 30, 28, 24
	tableAltR, tableAltG, tableAltB          = 248, 247, 244
	labelW                                   = 35.0 // label column width inside cards
	cardPad                                  = 5.0  // inner padding of section cards
	borderR, borderG, borderB                = 220, 218, 212
)

func buildPDF(data *reportData) ([]byte, string, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 25)
	pdf.SetMargins(marginL, 10, marginR)

	reportDate := time.Now().UTC().Format("2006-01-02 15:04 UTC")
	requestID := uuid.New().String()[:8]

	// Count stats
	completedTasks := make([]domain.Task, 0)
	for _, t := range data.Tasks {
		if t.Status == domain.TaskStatusCompleted {
			completedTasks = append(completedTasks, t)
		}
	}
	photoCount := 0
	for _, e := range data.Events {
		if e.EventType == domain.EventTypePhotoAdded {
			photoCount++
		}
	}

	// Total pages estimate
	totalPages := 1
	if len(data.Events) > 0 {
		totalPages++
	}
	if len(completedTasks) > 0 || len(data.Documents) > 0 {
		totalPages++
	}

	// Register logo image
	pdf.RegisterImageOptionsReader("logo", fpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(logoPNG))

	// ══════════════════════════════════════════════════════════
	// PAGE 1: Header + Vehicle Summary
	// ══════════════════════════════════════════════════════════
	pdf.AddPage()
	drawHeader(pdf, data.TenantName)
	drawPageFooter(pdf, reportDate, requestID, 1, totalPages)

	// Report metadata line
	pdf.SetY(headerH + 10)
	pdf.SetFont("Helvetica", "", 7)
	pdf.SetTextColor(160, 155, 145)
	pdf.CellFormat(contentW/2, 4, fmt.Sprintf("Generated: %s", reportDate), "", 0, "L", false, 0, "")
	pdf.CellFormat(contentW/2, 4, fmt.Sprintf("Report ID: %s", requestID), "", 1, "R", false, 0, "")
	pdf.Ln(7)

	// ── Vehicle Information card ──
	drawSectionCard(pdf, marginL, contentW, "Vehicle Information", func(x, innerW float64) {
		infoRow(pdf, x, innerW, "Make / Model", fmt.Sprintf("%s %s", data.Vehicle.Make, data.Vehicle.Model))
		if data.Vehicle.Year != nil {
			infoRow(pdf, x, innerW, "Year", fmt.Sprintf("%d", *data.Vehicle.Year))
		}
		if data.Vehicle.Color != nil {
			infoRow(pdf, x, innerW, "Color", *data.Vehicle.Color)
		}
		if data.Vehicle.LicensePlate != nil {
			infoRow(pdf, x, innerW, "License Plate", *data.Vehicle.LicensePlate)
		}
		if data.Vehicle.VIN != nil {
			infoRow(pdf, x, innerW, "VIN", *data.Vehicle.VIN)
		}
		infoRow(pdf, x, innerW, "Status", statusLabel(data.Vehicle.Status))
	})
	pdf.Ln(4)

	// ── Owner + Custody Period side by side ──
	colGap := 4.0
	colW := (contentW - colGap) / 2
	startY := pdf.GetY()

	// Left column: Owner
	ownerEndY := drawSectionCard(pdf, marginL, colW, "Owner", func(x, innerW float64) {
		infoRow(pdf, x, innerW, "Name", data.Vehicle.OwnerName)
		if data.Vehicle.OwnerEmail != nil {
			infoRow(pdf, x, innerW, "Email", *data.Vehicle.OwnerEmail)
		}
		if data.Vehicle.OwnerPhone != nil {
			infoRow(pdf, x, innerW, "Phone", *data.Vehicle.OwnerPhone)
		}
	})

	// Right column: Custody Period
	pdf.SetY(startY)
	custodyEndY := drawSectionCard(pdf, marginL+colW+colGap, colW, "Custody Period", func(x, innerW float64) {
		intakeDate := data.Vehicle.CreatedAt.Format("2006-01-02 15:04")
		exitLabel := "In custody"
		if data.Vehicle.Status == "out" {
			for i := len(data.Events) - 1; i >= 0; i-- {
				if data.Events[i].EventType == domain.EventTypeVehicleExit {
					exitLabel = data.Events[i].OccurredAt.Format("2006-01-02 15:04")
					break
				}
			}
		}
		infoRow(pdf, x, innerW, "Intake", intakeDate)
		infoRow(pdf, x, innerW, "Exit", exitLabel)
	})

	// Move Y below the tallest column
	pdf.SetY(math.Max(ownerEndY, custodyEndY) + 4)

	// ── Stats cards row ──
	statGap := 4.0
	statW := (contentW - 3*statGap) / 4
	statsY := pdf.GetY()
	drawStatCard(pdf, marginL, statW, fmt.Sprintf("%d", len(data.Events)), "EVENTS", statsY)
	drawStatCard(pdf, marginL+statW+statGap, statW, fmt.Sprintf("%d", len(completedTasks)), "TASKS COMPLETED", statsY)
	drawStatCard(pdf, marginL+2*(statW+statGap), statW, fmt.Sprintf("%d", len(data.Documents)), "DOCUMENTS", statsY)
	drawStatCard(pdf, marginL+3*(statW+statGap), statW, fmt.Sprintf("%d", photoCount), "PHOTOS", statsY)
	pdf.SetY(statsY + 22)

	// ══════════════════════════════════════════════════════════
	// PAGE 2: Timeline
	// ══════════════════════════════════════════════════════════
	pageNum := 1
	if len(data.Events) > 0 {
		pageNum++
		pdf.AddPage()
		drawPageFooter(pdf, reportDate, requestID, pageNum, totalPages)
		pageSectionTitle(pdf, "Complete Timeline")
		pdf.Ln(1)

		drawTableHeader(pdf, []colDef{
			{w: 38, label: "DATE"},
			{w: 42, label: "EVENT TYPE"},
			{w: contentW - 80, label: "NOTES"},
		})

		for i, event := range data.Events {
			if pdf.GetY() > footerY-10 {
				pdf.AddPage()
				drawPageFooter(pdf, reportDate, requestID, pageNum, totalPages)
			}
			alt := i%2 == 0
			if alt {
				pdf.SetFillColor(tableAltR, tableAltG, tableAltB)
			}
			pdf.SetFont("Helvetica", "", 8)
			pdf.SetTextColor(50, 50, 50)
			pdf.CellFormat(38, 7, event.OccurredAt.Format("2006-01-02 15:04"), "", 0, "L", alt, 0, "")
			pdf.CellFormat(42, 7, formatEventType(event.EventType), "", 0, "L", alt, 0, "")
			notes := ""
			if event.Notes != nil {
				notes = *event.Notes
			}
			if len(notes) > 70 {
				notes = notes[:67] + "..."
			}
			pdf.CellFormat(contentW-80, 7, notes, "", 1, "L", alt, 0, "")
		}
	}

	// ══════════════════════════════════════════════════════════
	// PAGE 3: Tasks + Documents
	// ══════════════════════════════════════════════════════════
	if len(completedTasks) > 0 || len(data.Documents) > 0 {
		needNewPage := true
		if len(completedTasks) > 0 {
			if needNewPage {
				pageNum++
				pdf.AddPage()
				drawPageFooter(pdf, reportDate, requestID, pageNum, totalPages)
				needNewPage = false
			}
			pageSectionTitle(pdf, "Completed Tasks")
			pdf.Ln(1)

			drawTableHeader(pdf, []colDef{
				{w: 55, label: "TASK"},
				{w: 30, label: "TYPE"},
				{w: 35, label: "COMPLETED"},
				{w: contentW - 120, label: "NOTES"},
			})

			for i, task := range completedTasks {
				if pdf.GetY() > footerY-10 {
					pdf.AddPage()
					drawPageFooter(pdf, reportDate, requestID, pageNum, totalPages)
				}
				alt := i%2 == 0
				if alt {
					pdf.SetFillColor(tableAltR, tableAltG, tableAltB)
				}
				title := task.Title
				if len(title) > 35 {
					title = title[:32] + "..."
				}
				completedAt := ""
				if task.CompletedAt != nil {
					completedAt = task.CompletedAt.Format("2006-01-02 15:04")
				}
				pdf.SetFont("Helvetica", "", 8)
				pdf.SetTextColor(50, 50, 50)
				pdf.CellFormat(55, 7, title, "", 0, "L", alt, 0, "")
				pdf.CellFormat(30, 7, task.TaskType, "", 0, "L", alt, 0, "")
				pdf.CellFormat(35, 7, completedAt, "", 0, "L", alt, 0, "")
				desc := ""
				if task.Description != nil {
					desc = *task.Description
				}
				if len(desc) > 40 {
					desc = desc[:37] + "..."
				}
				pdf.CellFormat(contentW-120, 7, desc, "", 1, "L", alt, 0, "")
			}
		}

		if len(data.Documents) > 0 {
			if needNewPage {
				pageNum++
				pdf.AddPage()
				drawPageFooter(pdf, reportDate, requestID, pageNum, totalPages)
				needNewPage = false //nolint:ineffassign // clarity
			}
			pdf.Ln(8)
			pageSectionTitle(pdf, "Documents")
			pdf.Ln(1)

			drawTableHeader(pdf, []colDef{
				{w: 60, label: "FILENAME"},
				{w: 30, label: "TYPE"},
				{w: 35, label: "UPLOADED"},
				{w: contentW - 125, label: "NOTES"},
			})

			for i, doc := range data.Documents {
				if pdf.GetY() > footerY-10 {
					pdf.AddPage()
					drawPageFooter(pdf, reportDate, requestID, pageNum, totalPages)
				}
				alt := i%2 == 0
				if alt {
					pdf.SetFillColor(tableAltR, tableAltG, tableAltB)
				}
				filename := doc.Filename
				if len(filename) > 38 {
					filename = filename[:35] + "..."
				}
				notes := ""
				if doc.Notes != nil {
					notes = *doc.Notes
				}
				if len(notes) > 35 {
					notes = notes[:32] + "..."
				}
				pdf.SetFont("Helvetica", "", 8)
				pdf.SetTextColor(50, 50, 50)
				pdf.CellFormat(60, 7, filename, "", 0, "L", alt, 0, "")
				pdf.CellFormat(30, 7, doc.DocType, "", 0, "L", alt, 0, "")
				pdf.CellFormat(35, 7, doc.CreatedAt.Format("2006-01-02 15:04"), "", 0, "L", alt, 0, "")
				pdf.CellFormat(contentW-125, 7, notes, "", 1, "L", alt, 0, "")
			}
		}
	}

	// Output
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, "", fmt.Errorf("generate PDF: %w", err)
	}

	filename := fmt.Sprintf("HeritageMotor_%s_%s_%s.pdf",
		data.Vehicle.Make, data.Vehicle.Model,
		time.Now().Format("2006-01-02"))

	return buf.Bytes(), filename, nil
}

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

func drawHeader(pdf *fpdf.Fpdf, tenantName string) {
	pdf.SetFillColor(darkR, darkG, darkB)
	pdf.Rect(0, 0, pageW, headerH, "F")

	// Gold accent line
	pdf.SetFillColor(goldR, goldG, goldB)
	pdf.Rect(0, headerH, pageW, 0.5, "F")

	// Logo centered
	logoX := (pageW - logoSize) / 2
	pdf.ImageOptions("logo", logoX, 5, logoSize, logoSize, false,
		fpdf.ImageOptions{ImageType: "PNG"}, 0, "")

	// Brand name
	pdf.SetFont("Times", "B", 14)
	pdf.SetTextColor(goldR, goldG, goldB)
	pdf.SetY(27)
	pdf.CellFormat(pageW, 6, "HERITAGE  MOTOR", "", 1, "C", false, 0, "")

	// Subtitle
	pdf.SetFont("Helvetica", "", 8.5)
	pdf.SetTextColor(180, 175, 165)
	pdf.CellFormat(pageW, 4.5, "Vehicle Chain of Custody Report", "", 1, "C", false, 0, "")

	// Tenant name
	if tenantName != "" {
		pdf.SetFont("Helvetica", "", 7.5)
		pdf.SetTextColor(150, 145, 135)
		pdf.CellFormat(pageW, 4, tenantName, "", 1, "C", false, 0, "")
	}

	// Diamond separator
	midX := pageW / 2
	diamondY := headerH - 5.0
	pdf.SetDrawColor(goldR, goldG, goldB)
	pdf.SetLineWidth(0.3)
	pdf.SetAlpha(0.4, "Normal")
	pdf.Line(midX-20, diamondY, midX-4, diamondY)
	pdf.Line(midX+4, diamondY, midX+20, diamondY)
	d := 1.5
	pdf.SetFillColor(goldR, goldG, goldB)
	pdf.Polygon([]fpdf.PointType{
		{X: midX, Y: diamondY - d},
		{X: midX + d, Y: diamondY},
		{X: midX, Y: diamondY + d},
		{X: midX - d, Y: diamondY},
	}, "F")
	pdf.SetAlpha(1.0, "Normal")
}

// ─────────────────────────────────────────────────────────────
// Section Card (bordered box with title + content)
// ─────────────────────────────────────────────────────────────

// drawSectionCard draws a bordered card at (cardX, current Y) with width cardW.
// Returns the Y position after the card bottom.
func drawSectionCard(pdf *fpdf.Fpdf, cardX, cardW float64, title string, fn func(x, innerW float64)) float64 {
	startY := pdf.GetY()
	innerX := cardX + cardPad
	innerW := cardW - 2*cardPad

	// Title
	pdf.SetXY(innerX, startY+cardPad)
	pdf.SetFont("Times", "I", 14)
	pdf.SetTextColor(goldR, goldG, goldB)
	pdf.CellFormat(innerW, 7, title, "", 1, "L", false, 0, "")

	// Gold underline
	y := pdf.GetY() + 0.5
	pdf.SetDrawColor(goldR, goldG, goldB)
	pdf.SetAlpha(0.3, "Normal")
	pdf.SetLineWidth(0.3)
	pdf.Line(innerX, y, innerX+innerW, y)
	pdf.SetAlpha(1.0, "Normal")
	pdf.SetY(y + 3)

	// Content
	fn(innerX, innerW)

	endY := pdf.GetY() + cardPad

	// Draw border
	pdf.SetDrawColor(borderR, borderG, borderB)
	pdf.SetLineWidth(0.3)
	pdf.RoundedRect(cardX, startY, cardW, endY-startY, 1.5, "1234", "D")

	pdf.SetY(endY)
	return endY
}

// ─────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────

func drawStatCard(pdf *fpdf.Fpdf, x, w float64, value, label string, y float64) {
	h := 20.0

	// Border
	pdf.SetDrawColor(borderR, borderG, borderB)
	pdf.SetLineWidth(0.3)
	pdf.RoundedRect(x, y, w, h, 1.5, "1234", "D")

	// Value
	pdf.SetXY(x, y+3)
	pdf.SetFont("Helvetica", "", 22)
	pdf.SetTextColor(40, 38, 35)
	pdf.CellFormat(w, 8, value, "", 1, "C", false, 0, "")

	// Label
	pdf.SetX(x)
	pdf.SetFont("Helvetica", "", 6.5)
	pdf.SetTextColor(160, 155, 145)
	pdf.CellFormat(w, 4, label, "", 1, "C", false, 0, "")
}

// ─────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────

func drawPageFooter(pdf *fpdf.Fpdf, reportDate, requestID string, pageNum, totalPages int) {
	pdf.SetFooterFunc(func() {
		pdf.SetY(-18)
		// Gold separator
		pdf.SetDrawColor(goldR, goldG, goldB)
		pdf.SetAlpha(0.35, "Normal")
		pdf.SetLineWidth(0.3)
		pdf.Line(marginL, pdf.GetY(), pageW-marginR, pdf.GetY())
		pdf.SetAlpha(1.0, "Normal")
		pdf.Ln(2)
		// Footer text
		pdf.SetFont("Helvetica", "", 6.5)
		pdf.SetTextColor(140, 140, 140)
		pdf.CellFormat(contentW, 3.5,
			fmt.Sprintf("Heritage Motor  |  %s  |  Report ID: %s", reportDate, requestID),
			"", 1, "C", false, 0, "")
		pdf.SetFont("Helvetica", "", 6)
		pdf.SetTextColor(goldR, goldG, goldB)
		pdf.CellFormat(contentW, 3.5, "heritagemotor.app", "", 0, "C", false, 0, "")
		// Page number
		pdf.SetFont("Helvetica", "", 6.5)
		pdf.SetTextColor(160, 155, 145)
		pdf.SetXY(pageW-marginR-15, pdf.GetY()-3.5)
		pdf.CellFormat(15, 3.5, fmt.Sprintf("%d / %d", pageNum, totalPages), "", 0, "R", false, 0, "")
	})
}

// ─────────────────────────────────────────────────────────────
// Table helpers
// ─────────────────────────────────────────────────────────────

type colDef struct {
	w     float64
	label string
}

func drawTableHeader(pdf *fpdf.Fpdf, cols []colDef) {
	pdf.SetFont("Helvetica", "B", 7)
	pdf.SetFillColor(tableHeaderR, tableHeaderG, tableHeaderB)
	pdf.SetTextColor(goldR, goldG, goldB)
	for _, c := range cols {
		pdf.CellFormat(c.w, 7, "  "+c.label, "", 0, "L", true, 0, "")
	}
	pdf.Ln(-1)
	pdf.SetTextColor(50, 50, 50)
}

// ─────────────────────────────────────────────────────────────
// Page section title (for table pages, no card border)
// ─────────────────────────────────────────────────────────────

func pageSectionTitle(pdf *fpdf.Fpdf, title string) {
	pdf.SetFont("Times", "I", 16)
	pdf.SetTextColor(goldR, goldG, goldB)
	pdf.CellFormat(contentW, 9, title, "", 1, "L", false, 0, "")
	// Gold underline
	pdf.SetDrawColor(goldR, goldG, goldB)
	pdf.SetLineWidth(0.5)
	y := pdf.GetY()
	pdf.Line(marginL, y, marginL+contentW, y)
	pdf.Ln(3)
}

// ─────────────────────────────────────────────────────────────
// Info row (label + value inside a card)
// ─────────────────────────────────────────────────────────────

func infoRow(pdf *fpdf.Fpdf, x, innerW float64, label, value string) {
	pdf.SetX(x)
	pdf.SetFont("Helvetica", "", 8.5)
	pdf.SetTextColor(140, 135, 125)
	pdf.CellFormat(labelW, 6.5, label, "", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9.5)
	pdf.SetTextColor(40, 38, 35)
	pdf.CellFormat(innerW-labelW, 6.5, value, "", 1, "L", false, 0, "")
}

// ─────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────

func statusLabel(status string) string {
	switch status {
	case "stored":
		return "Stored"
	case "out":
		return "Released"
	case "maintenance":
		return "In Maintenance"
	default:
		return status
	}
}

func formatEventType(et string) string {
	switch et {
	case domain.EventTypeVehicleIntake:
		return "Vehicle Intake"
	case domain.EventTypeVehicleExit:
		return "Vehicle Exit"
	case domain.EventTypeVehicleMoved:
		return "Vehicle Moved"
	case domain.EventTypeTaskCompleted:
		return "Task Completed"
	case domain.EventTypeDocumentAdded:
		return "Document Added"
	case domain.EventTypePhotoAdded:
		return "Photo Added"
	case domain.EventTypeStatusChanged:
		return "Status Changed"
	case domain.EventTypeNoteAdded:
		return "Note Added"
	case domain.EventTypeIncidentReported:
		return "Incident Reported"
	default:
		return et
	}
}
