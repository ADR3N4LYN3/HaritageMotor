package report

import (
	"bytes"
	"fmt"
	"time"

	"github.com/go-pdf/fpdf"
	"github.com/google/uuid"

	"github.com/chriis/heritage-motor/internal/domain"
)

// Brand colors
const (
	goldR, goldG, goldB                      = 184, 149, 90
	darkR, darkG, darkB                      = 14, 13, 11
	headerH                                  = 52.0  // dark header band height
	logoSize                                 = 18.0  // logo in header
	pageW                                    = 210.0 // A4
	marginL                                  = 20.0
	marginR                                  = 20.0
	contentW                                 = pageW - marginL - marginR
	footerY                                  = 280.0
	tableHeaderR, tableHeaderG, tableHeaderB = 30, 28, 24
	tableAltR, tableAltG, tableAltB          = 248, 247, 244
	labelW                                   = 42.0 // label column width for info rows
	sectionPadding                           = 5.0  // inner padding of section boxes
)

func buildPDF(data *reportData) ([]byte, string, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 25)
	pdf.SetMargins(marginL, 10, marginR)

	reportDate := time.Now().UTC().Format("2006-01-02 15:04 UTC")
	requestID := uuid.New().String()[:8]

	// Register logo image
	pdf.RegisterImageOptionsReader("logo", fpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(logoPNG))

	// ── Page 1: Header + Vehicle Summary ──
	pdf.AddPage()
	drawHeader(pdf, data.TenantName)
	drawPageFooter(pdf, reportDate, requestID)

	// Report metadata line
	pdf.SetY(headerH + 10)
	pdf.SetFont("Helvetica", "", 7)
	pdf.SetTextColor(160, 155, 145)
	pdf.CellFormat(contentW/2, 4, fmt.Sprintf("Generated: %s", reportDate), "", 0, "L", false, 0, "")
	pdf.CellFormat(contentW/2, 4, fmt.Sprintf("Report ID: %s", requestID), "", 1, "R", false, 0, "")
	pdf.Ln(8)

	// ── Vehicle Information card ──
	drawSectionBox(pdf, "Vehicle Information", func() {
		infoRow(pdf, "Make / Model", fmt.Sprintf("%s %s", data.Vehicle.Make, data.Vehicle.Model))
		if data.Vehicle.Year != nil {
			infoRow(pdf, "Year", fmt.Sprintf("%d", *data.Vehicle.Year))
		}
		if data.Vehicle.Color != nil {
			infoRow(pdf, "Color", *data.Vehicle.Color)
		}
		if data.Vehicle.LicensePlate != nil {
			infoRow(pdf, "License Plate", *data.Vehicle.LicensePlate)
		}
		if data.Vehicle.VIN != nil {
			infoRow(pdf, "VIN", *data.Vehicle.VIN)
		}
		infoRow(pdf, "Status", statusLabel(data.Vehicle.Status))
	})

	pdf.Ln(4)

	// ── Owner card ──
	drawSectionBox(pdf, "Owner", func() {
		infoRow(pdf, "Name", data.Vehicle.OwnerName)
		if data.Vehicle.OwnerEmail != nil {
			infoRow(pdf, "Email", *data.Vehicle.OwnerEmail)
		}
		if data.Vehicle.OwnerPhone != nil {
			infoRow(pdf, "Phone", *data.Vehicle.OwnerPhone)
		}
	})

	pdf.Ln(4)

	// ── Custody Period card ──
	drawSectionBox(pdf, "Custody Period", func() {
		intakeDate := data.Vehicle.CreatedAt.Format("2006-01-02 15:04")
		exitDate := "In custody"
		if data.Vehicle.Status == "out" {
			for i := len(data.Events) - 1; i >= 0; i-- {
				if data.Events[i].EventType == domain.EventTypeVehicleExit {
					exitDate = data.Events[i].OccurredAt.Format("2006-01-02 15:04")
					break
				}
			}
		}
		infoRow(pdf, "Intake", intakeDate)
		infoRow(pdf, "Exit", exitDate)
	})

	// ── Timeline ──
	if len(data.Events) > 0 {
		pdf.AddPage()
		drawPageFooter(pdf, reportDate, requestID)
		sectionTitle(pdf, "Complete Timeline")
		pdf.Ln(2)

		drawTableHeader(pdf, []colDef{
			{w: 38, label: "DATE"},
			{w: 42, label: "EVENT TYPE"},
			{w: contentW - 80, label: "NOTES"},
		})

		pdf.SetFont("Helvetica", "", 7.5)
		for i, event := range data.Events {
			if pdf.GetY() > footerY-10 {
				pdf.AddPage()
				drawPageFooter(pdf, reportDate, requestID)
			}
			alt := i%2 == 0
			if alt {
				pdf.SetFillColor(tableAltR, tableAltG, tableAltB)
			}
			pdf.SetTextColor(50, 50, 50)
			pdf.CellFormat(38, 6, event.OccurredAt.Format("2006-01-02 15:04"), "", 0, "L", alt, 0, "")
			pdf.CellFormat(42, 6, formatEventType(event.EventType), "", 0, "L", alt, 0, "")
			notes := ""
			if event.Notes != nil {
				notes = *event.Notes
			}
			if len(notes) > 70 {
				notes = notes[:67] + "..."
			}
			pdf.CellFormat(contentW-80, 6, notes, "", 1, "L", alt, 0, "")
		}
	}

	// ── Tasks ──
	completedTasks := make([]domain.Task, 0)
	for _, t := range data.Tasks {
		if t.Status == domain.TaskStatusCompleted {
			completedTasks = append(completedTasks, t)
		}
	}
	if len(completedTasks) > 0 {
		if pdf.GetY() > footerY-30 {
			pdf.AddPage()
			drawPageFooter(pdf, reportDate, requestID)
		}
		pdf.Ln(8)
		sectionTitle(pdf, "Completed Tasks")
		pdf.Ln(2)

		drawTableHeader(pdf, []colDef{
			{w: 55, label: "TASK"},
			{w: 30, label: "TYPE"},
			{w: 35, label: "COMPLETED"},
			{w: contentW - 120, label: "NOTES"},
		})

		pdf.SetFont("Helvetica", "", 7.5)
		for i, task := range completedTasks {
			if pdf.GetY() > footerY-10 {
				pdf.AddPage()
				drawPageFooter(pdf, reportDate, requestID)
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
			pdf.SetTextColor(50, 50, 50)
			pdf.CellFormat(55, 6, title, "", 0, "L", alt, 0, "")
			pdf.CellFormat(30, 6, task.TaskType, "", 0, "L", alt, 0, "")
			pdf.CellFormat(35, 6, completedAt, "", 0, "L", alt, 0, "")
			desc := ""
			if task.Description != nil {
				desc = *task.Description
			}
			if len(desc) > 40 {
				desc = desc[:37] + "..."
			}
			pdf.CellFormat(contentW-120, 6, desc, "", 1, "L", alt, 0, "")
		}
	}

	// ── Documents ──
	if len(data.Documents) > 0 {
		if pdf.GetY() > footerY-30 {
			pdf.AddPage()
			drawPageFooter(pdf, reportDate, requestID)
		}
		pdf.Ln(8)
		sectionTitle(pdf, "Documents")
		pdf.Ln(2)

		drawTableHeader(pdf, []colDef{
			{w: 60, label: "FILENAME"},
			{w: 30, label: "TYPE"},
			{w: 35, label: "UPLOADED"},
			{w: contentW - 125, label: "NOTES"},
		})

		pdf.SetFont("Helvetica", "", 7.5)
		for i, doc := range data.Documents {
			if pdf.GetY() > footerY-10 {
				pdf.AddPage()
				drawPageFooter(pdf, reportDate, requestID)
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
			pdf.SetTextColor(50, 50, 50)
			pdf.CellFormat(60, 6, filename, "", 0, "L", alt, 0, "")
			pdf.CellFormat(30, 6, doc.DocType, "", 0, "L", alt, 0, "")
			pdf.CellFormat(35, 6, doc.CreatedAt.Format("2006-01-02 15:04"), "", 0, "L", alt, 0, "")
			pdf.CellFormat(contentW-125, 6, notes, "", 1, "L", alt, 0, "")
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

// drawHeader renders the dark premium header band with logo and branding.
func drawHeader(pdf *fpdf.Fpdf, tenantName string) {
	// Dark header background
	pdf.SetFillColor(darkR, darkG, darkB)
	pdf.Rect(0, 0, pageW, headerH, "F")

	// Gold accent line at bottom of header
	pdf.SetFillColor(goldR, goldG, goldB)
	pdf.Rect(0, headerH, pageW, 0.5, "F")

	// Logo centered
	logoX := (pageW - logoSize) / 2
	pdf.ImageOptions("logo", logoX, 5, logoSize, logoSize, false,
		fpdf.ImageOptions{ImageType: "PNG"}, 0, "")

	// Brand name — serif, gold, uppercase
	pdf.SetFont("Times", "B", 12)
	pdf.SetTextColor(goldR, goldG, goldB)
	pdf.SetY(25)
	pdf.CellFormat(pageW, 5, "HERITAGE  MOTOR", "", 1, "C", false, 0, "")

	// Subtitle
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(180, 175, 165)
	pdf.CellFormat(pageW, 4, "Vehicle Chain of Custody Report", "", 1, "C", false, 0, "")

	// Facility name
	if tenantName != "" {
		pdf.SetFont("Helvetica", "", 7)
		pdf.SetTextColor(150, 145, 135)
		pdf.CellFormat(pageW, 4, tenantName, "", 1, "C", false, 0, "")
	}

	// Gold diamond accent (decorative separator)
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

// drawSectionBox draws a bordered card with a title and content rendered by fn.
func drawSectionBox(pdf *fpdf.Fpdf, title string, fn func()) {
	startY := pdf.GetY()

	// Title
	pdf.SetFont("Times", "B", 11)
	pdf.SetTextColor(goldR, goldG, goldB)
	pdf.SetX(marginL + sectionPadding)
	pdf.CellFormat(contentW-2*sectionPadding, 7, title, "", 1, "L", false, 0, "")

	// Gold underline under title
	pdf.SetDrawColor(goldR, goldG, goldB)
	pdf.SetAlpha(0.3, "Normal")
	pdf.SetLineWidth(0.3)
	y := pdf.GetY()
	pdf.Line(marginL+sectionPadding, y, marginL+contentW-sectionPadding, y)
	pdf.SetAlpha(1.0, "Normal")
	pdf.Ln(3)

	// Save X for content indent
	origX := pdf.GetX()
	pdf.SetX(marginL + sectionPadding)

	// Render content
	fn()

	pdf.SetX(origX)
	pdf.Ln(2)
	endY := pdf.GetY()

	// Draw border box around the whole section
	pdf.SetDrawColor(220, 218, 212)
	pdf.SetLineWidth(0.3)
	pdf.RoundedRect(marginL, startY-1, contentW, endY-startY+2, 1.5, "1234", "D")
}

// drawPageFooter sets up a footer at the bottom of every page.
func drawPageFooter(pdf *fpdf.Fpdf, reportDate, requestID string) {
	pdf.SetFooterFunc(func() {
		pdf.SetY(-18)
		// Gold separator line
		pdf.SetDrawColor(goldR, goldG, goldB)
		pdf.SetAlpha(0.4, "Normal")
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
	})
}

type colDef struct {
	w     float64
	label string
}

// drawTableHeader renders a dark-themed table header row.
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

func sectionTitle(pdf *fpdf.Fpdf, title string) {
	pdf.SetFont("Times", "B", 13)
	pdf.SetTextColor(goldR, goldG, goldB)
	pdf.CellFormat(contentW, 8, title, "", 1, "L", false, 0, "")
	// Gold underline
	pdf.SetDrawColor(goldR, goldG, goldB)
	pdf.SetLineWidth(0.4)
	y := pdf.GetY()
	pdf.Line(marginL, y, marginL+contentW, y)
	pdf.Ln(2)
}

func infoRow(pdf *fpdf.Fpdf, label, value string) {
	x := pdf.GetX()
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(140, 135, 125)
	pdf.CellFormat(labelW, 6, label, "", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(40, 38, 35)
	pdf.CellFormat(contentW-labelW-2*sectionPadding, 6, value, "", 1, "L", false, 0, "")
	pdf.SetX(x)
}

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
