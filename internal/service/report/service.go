package report

import (
	"bytes"
	"context"
	"fmt"
	"time"

	"github.com/go-pdf/fpdf"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/chriis/heritage-motor/internal/db"
	"github.com/chriis/heritage-motor/internal/domain"
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

type reportData struct {
	Vehicle    domain.Vehicle
	Events     []domain.Event
	Tasks      []domain.Task
	Documents  []domain.Document
	TenantName string
}

func (s *Service) GenerateVehicleReport(ctx context.Context, tenantID, vehicleID uuid.UUID) ([]byte, string, error) {
	data, err := s.loadReportData(ctx, tenantID, vehicleID)
	if err != nil {
		return nil, "", err
	}

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 20)

	// Colors
	goldR, goldG, goldB := 184, 149, 90

	// ── Page 1: Header + Vehicle Summary ──
	pdf.AddPage()

	// Header
	pdf.SetFillColor(goldR, goldG, goldB)
	pdf.Rect(0, 0, 210, 3, "F")
	pdf.SetFont("Helvetica", "B", 18)
	pdf.SetTextColor(40, 40, 40)
	pdf.SetY(12)
	pdf.CellFormat(190, 10, "Heritage Motor", "", 1, "C", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(120, 120, 120)
	pdf.CellFormat(190, 5, "Vehicle Chain of Custody Report", "", 1, "C", false, 0, "")

	// Facility name
	if data.TenantName != "" {
		pdf.SetFont("Helvetica", "", 8)
		pdf.CellFormat(190, 5, data.TenantName, "", 1, "C", false, 0, "")
	}

	// Separator
	pdf.Ln(4)
	pdf.SetDrawColor(goldR, goldG, goldB)
	pdf.SetLineWidth(0.5)
	pdf.Line(10, pdf.GetY(), 200, pdf.GetY())
	pdf.Ln(6)

	// Report metadata
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(100, 100, 100)
	reportDate := time.Now().UTC().Format("2006-01-02 15:04 UTC")
	pdf.CellFormat(95, 4, fmt.Sprintf("Generated: %s", reportDate), "", 0, "L", false, 0, "")
	requestID := uuid.New().String()[:8]
	pdf.CellFormat(95, 4, fmt.Sprintf("Report ID: %s", requestID), "", 1, "R", false, 0, "")
	pdf.Ln(6)

	// Vehicle info section
	s.sectionTitle(pdf, "Vehicle Information", goldR, goldG, goldB)
	s.infoRow(pdf, "Make / Model", fmt.Sprintf("%s %s", data.Vehicle.Make, data.Vehicle.Model))
	if data.Vehicle.Year != nil {
		s.infoRow(pdf, "Year", fmt.Sprintf("%d", *data.Vehicle.Year))
	}
	if data.Vehicle.Color != nil {
		s.infoRow(pdf, "Color", *data.Vehicle.Color)
	}
	if data.Vehicle.LicensePlate != nil {
		s.infoRow(pdf, "License Plate", *data.Vehicle.LicensePlate)
	}
	if data.Vehicle.VIN != nil {
		s.infoRow(pdf, "VIN", *data.Vehicle.VIN)
	}
	s.infoRow(pdf, "Status", data.Vehicle.Status)
	pdf.Ln(4)

	// Owner info
	s.sectionTitle(pdf, "Owner", goldR, goldG, goldB)
	s.infoRow(pdf, "Name", data.Vehicle.OwnerName)
	if data.Vehicle.OwnerEmail != nil {
		s.infoRow(pdf, "Email", *data.Vehicle.OwnerEmail)
	}
	if data.Vehicle.OwnerPhone != nil {
		s.infoRow(pdf, "Phone", *data.Vehicle.OwnerPhone)
	}
	pdf.Ln(4)

	// Custody period
	s.sectionTitle(pdf, "Custody Period", goldR, goldG, goldB)
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
	s.infoRow(pdf, "Intake", intakeDate)
	s.infoRow(pdf, "Exit", exitDate)

	// ── Timeline ──
	if len(data.Events) > 0 {
		pdf.AddPage()
		s.sectionTitle(pdf, "Complete Timeline", goldR, goldG, goldB)

		// Table header
		pdf.SetFont("Helvetica", "B", 8)
		pdf.SetFillColor(245, 245, 245)
		pdf.SetTextColor(60, 60, 60)
		pdf.CellFormat(35, 6, "Date", "B", 0, "L", true, 0, "")
		pdf.CellFormat(35, 6, "Event Type", "B", 0, "L", true, 0, "")
		pdf.CellFormat(120, 6, "Notes", "B", 1, "L", true, 0, "")

		pdf.SetFont("Helvetica", "", 7)
		pdf.SetTextColor(80, 80, 80)
		for _, event := range data.Events {
			if pdf.GetY() > 270 {
				pdf.AddPage()
			}
			pdf.CellFormat(35, 5, event.OccurredAt.Format("2006-01-02 15:04"), "", 0, "L", false, 0, "")
			pdf.CellFormat(35, 5, formatEventType(event.EventType), "", 0, "L", false, 0, "")
			notes := ""
			if event.Notes != nil {
				notes = *event.Notes
			}
			if len(notes) > 80 {
				notes = notes[:77] + "..."
			}
			pdf.CellFormat(120, 5, notes, "", 1, "L", false, 0, "")
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
		pdf.Ln(6)
		s.sectionTitle(pdf, "Completed Tasks", goldR, goldG, goldB)

		pdf.SetFont("Helvetica", "B", 8)
		pdf.SetFillColor(245, 245, 245)
		pdf.SetTextColor(60, 60, 60)
		pdf.CellFormat(60, 6, "Task", "B", 0, "L", true, 0, "")
		pdf.CellFormat(30, 6, "Type", "B", 0, "L", true, 0, "")
		pdf.CellFormat(35, 6, "Completed", "B", 0, "L", true, 0, "")
		pdf.CellFormat(65, 6, "Notes", "B", 1, "L", true, 0, "")

		pdf.SetFont("Helvetica", "", 7)
		pdf.SetTextColor(80, 80, 80)
		for _, task := range completedTasks {
			if pdf.GetY() > 270 {
				pdf.AddPage()
			}
			title := task.Title
			if len(title) > 35 {
				title = title[:32] + "..."
			}
			completedAt := ""
			if task.CompletedAt != nil {
				completedAt = task.CompletedAt.Format("2006-01-02 15:04")
			}
			pdf.CellFormat(60, 5, title, "", 0, "L", false, 0, "")
			pdf.CellFormat(30, 5, task.TaskType, "", 0, "L", false, 0, "")
			pdf.CellFormat(35, 5, completedAt, "", 0, "L", false, 0, "")
			desc := ""
			if task.Description != nil {
				desc = *task.Description
			}
			if len(desc) > 40 {
				desc = desc[:37] + "..."
			}
			pdf.CellFormat(65, 5, desc, "", 1, "L", false, 0, "")
		}
	}

	// ── Documents ──
	if len(data.Documents) > 0 {
		pdf.Ln(6)
		s.sectionTitle(pdf, "Documents", goldR, goldG, goldB)

		pdf.SetFont("Helvetica", "B", 8)
		pdf.SetFillColor(245, 245, 245)
		pdf.SetTextColor(60, 60, 60)
		pdf.CellFormat(70, 6, "Filename", "B", 0, "L", true, 0, "")
		pdf.CellFormat(30, 6, "Type", "B", 0, "L", true, 0, "")
		pdf.CellFormat(35, 6, "Uploaded", "B", 0, "L", true, 0, "")
		pdf.CellFormat(55, 6, "Notes", "B", 1, "L", true, 0, "")

		pdf.SetFont("Helvetica", "", 7)
		pdf.SetTextColor(80, 80, 80)
		for _, doc := range data.Documents {
			if pdf.GetY() > 270 {
				pdf.AddPage()
			}
			filename := doc.Filename
			if len(filename) > 40 {
				filename = filename[:37] + "..."
			}
			notes := ""
			if doc.Notes != nil {
				notes = *doc.Notes
			}
			if len(notes) > 35 {
				notes = notes[:32] + "..."
			}
			pdf.CellFormat(70, 5, filename, "", 0, "L", false, 0, "")
			pdf.CellFormat(30, 5, doc.DocType, "", 0, "L", false, 0, "")
			pdf.CellFormat(35, 5, doc.CreatedAt.Format("2006-01-02 15:04"), "", 0, "L", false, 0, "")
			pdf.CellFormat(55, 5, notes, "", 1, "L", false, 0, "")
		}
	}

	// Footer on last page
	pdf.Ln(10)
	pdf.SetDrawColor(goldR, goldG, goldB)
	pdf.SetLineWidth(0.3)
	pdf.Line(10, pdf.GetY(), 200, pdf.GetY())
	pdf.Ln(3)
	pdf.SetFont("Helvetica", "I", 7)
	pdf.SetTextColor(140, 140, 140)
	pdf.CellFormat(190, 4, fmt.Sprintf("Generated by Heritage Motor | %s | Report ID: %s", reportDate, requestID), "", 1, "C", false, 0, "")

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

func (s *Service) sectionTitle(pdf *fpdf.Fpdf, title string, r, g, b int) {
	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(r, g, b)
	pdf.CellFormat(190, 7, title, "", 1, "L", false, 0, "")
	pdf.SetDrawColor(r, g, b)
	pdf.SetLineWidth(0.3)
	pdf.Line(10, pdf.GetY(), 200, pdf.GetY())
	pdf.Ln(3)
}

func (s *Service) infoRow(pdf *fpdf.Fpdf, label, value string) {
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(40, 5, label, "", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(40, 40, 40)
	pdf.CellFormat(150, 5, value, "", 1, "L", false, 0, "")
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

func (s *Service) loadReportData(ctx context.Context, tenantID, vehicleID uuid.UUID) (*reportData, error) {
	conn := db.Conn(ctx, s.pool)

	// Load vehicle
	var v domain.Vehicle
	err := conn.QueryRow(ctx,
		`SELECT id, tenant_id, make, model, year, color, license_plate, vin,
		 owner_name, owner_email, owner_phone, owner_notes, status,
		 current_bay_id, notes, tags, qr_token, created_at, updated_at
		 FROM vehicles WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
		vehicleID, tenantID,
	).Scan(
		&v.ID, &v.TenantID, &v.Make, &v.Model, &v.Year, &v.Color,
		&v.LicensePlate, &v.VIN, &v.OwnerName, &v.OwnerEmail,
		&v.OwnerPhone, &v.OwnerNotes, &v.Status, &v.CurrentBayID,
		&v.Notes, &v.Tags, &v.QRToken, &v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		return nil, &domain.ErrNotFound{Resource: "vehicle", ID: vehicleID}
	}

	// Load tenant name
	var tenantName string
	_ = conn.QueryRow(ctx, `SELECT name FROM tenants WHERE id = $1`, tenantID).Scan(&tenantName) //nolint:errcheck // optional

	// Load events
	rows, err := conn.Query(ctx,
		`SELECT id, tenant_id, vehicle_id, user_id, event_type, metadata, photo_keys, notes, occurred_at, source
		 FROM events WHERE vehicle_id = $1 AND tenant_id = $2
		 ORDER BY occurred_at ASC`,
		vehicleID, tenantID,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to load events for report")
		return nil, fmt.Errorf("load events: %w", err)
	}
	defer rows.Close()

	var events []domain.Event
	for rows.Next() {
		var e domain.Event
		if err := rows.Scan(&e.ID, &e.TenantID, &e.VehicleID, &e.UserID,
			&e.EventType, &e.Metadata, &e.PhotoKeys, &e.Notes,
			&e.OccurredAt, &e.Source); err != nil {
			return nil, fmt.Errorf("scan event: %w", err)
		}
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate events: %w", err)
	}

	// Load tasks
	taskRows, err := conn.Query(ctx,
		`SELECT id, tenant_id, vehicle_id, assigned_to, task_type, title, description,
		 status, due_date, completed_at, completed_by, recurrence_days, next_due_date,
		 created_at, updated_at
		 FROM tasks WHERE vehicle_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
		 ORDER BY created_at ASC`,
		vehicleID, tenantID,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to load tasks for report")
		return nil, fmt.Errorf("load tasks: %w", err)
	}
	defer taskRows.Close()

	var tasks []domain.Task
	for taskRows.Next() {
		var t domain.Task
		if err := taskRows.Scan(&t.ID, &t.TenantID, &t.VehicleID, &t.AssignedTo,
			&t.TaskType, &t.Title, &t.Description, &t.Status, &t.DueDate,
			&t.CompletedAt, &t.CompletedBy, &t.RecurrenceDays, &t.NextDueDate,
			&t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan task: %w", err)
		}
		tasks = append(tasks, t)
	}
	if err := taskRows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tasks: %w", err)
	}

	// Load documents
	docRows, err := conn.Query(ctx,
		`SELECT id, tenant_id, vehicle_id, uploaded_by, doc_type, filename, s3_key,
		 mime_type, size_bytes, expires_at, notes, created_at
		 FROM documents WHERE vehicle_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
		 ORDER BY created_at ASC`,
		vehicleID, tenantID,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to load documents for report")
		return nil, fmt.Errorf("load documents: %w", err)
	}
	defer docRows.Close()

	var docs []domain.Document
	for docRows.Next() {
		var d domain.Document
		if err := docRows.Scan(&d.ID, &d.TenantID, &d.VehicleID, &d.UploadedBy,
			&d.DocType, &d.Filename, &d.S3Key, &d.MimeType,
			&d.SizeBytes, &d.ExpiresAt, &d.Notes, &d.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan document: %w", err)
		}
		docs = append(docs, d)
	}
	if err := docRows.Err(); err != nil {
		return nil, fmt.Errorf("iterate documents: %w", err)
	}

	return &reportData{
		Vehicle:    v,
		Events:     events,
		Tasks:      tasks,
		Documents:  docs,
		TenantName: tenantName,
	}, nil
}
