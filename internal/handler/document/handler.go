package document

import (
	"fmt"
	"strings"
	"time"

	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
	docSvc "github.com/chriis/heritage-motor/internal/service/document"
	"github.com/chriis/heritage-motor/internal/storage"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type Handler struct {
	svc *docSvc.Service
	s3  *storage.S3Client
}

func NewHandler(svc *docSvc.Service, s3Client *storage.S3Client) *Handler {
	return &Handler{svc: svc, s3: s3Client}
}

func (h *Handler) RegisterRoutes(r fiber.Router) {
	r.Get("/vehicles/:id/documents", h.List)
	r.Get("/vehicles/:id/documents/:docId", h.GetByID)
	r.Post("/vehicles/:id/documents", h.Create)
	r.Delete("/vehicles/:id/documents/:docId", h.Delete)
}

// List GET /vehicles/:id/documents
func (h *Handler) List(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	vehicleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid vehicle id"})
	}

	docs, err := h.svc.List(c.Context(), tenantID, vehicleID)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(fiber.Map{"data": docs})
}

// GetByID GET /vehicles/:id/documents/:docId
func (h *Handler) GetByID(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	vehicleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid vehicle id"})
	}

	docID, err := uuid.Parse(c.Params("docId"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid document id"})
	}

	doc, err := h.svc.GetByID(c.Context(), tenantID, vehicleID, docID)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(doc)
}

// Create POST /vehicles/:id/documents (multipart/form-data)
func (h *Handler) Create(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	vehicleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid vehicle id"})
	}

	// Parse multipart form
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "file is required"})
	}

	// Validate file size (max 20MB per file)
	const maxFileSize = 20 * 1024 * 1024
	if file.Size > maxFileSize {
		return c.Status(413).JSON(fiber.Map{"error": "file too large, max 20MB"})
	}

	// Validate MIME type
	allowedMIME := map[string]bool{
		"image/jpeg": true, "image/png": true, "image/webp": true, "image/heic": true,
		"application/pdf": true, "application/msword": true,
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
		"text/plain": true,
	}
	mimeType := file.Header.Get("Content-Type")
	if !allowedMIME[mimeType] {
		return c.Status(415).JSON(fiber.Map{"error": "unsupported file type"})
	}

	// Sanitize filename — strip path separators
	sanitizedFilename := file.Filename
	for _, ch := range []string{"/", "\\", "..", "\x00"} {
		sanitizedFilename = strings.ReplaceAll(sanitizedFilename, ch, "_")
	}

	docType := c.FormValue("doc_type")
	if docType == "" {
		return c.Status(422).JSON(fiber.Map{"error": "validation", "field": "doc_type", "message": "doc_type is required"})
	}

	notes := c.FormValue("notes")
	var notesPtr *string
	if notes != "" {
		notesPtr = &notes
	}

	var expiresAt *time.Time
	if ea := c.FormValue("expires_at"); ea != "" {
		t, err := time.Parse(time.RFC3339, ea)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid expires_at, expected RFC3339"})
		}
		expiresAt = &t
	}

	// Generate S3 key: {tenant_id}/documents/{vehicle_id}/{timestamp}_{filename}
	timestamp := time.Now().UTC().Unix()
	s3Key := fmt.Sprintf("%s/documents/%s/%d_%s",
		tenantID.String(), vehicleID.String(), timestamp, sanitizedFilename,
	)

	// Upload file to S3 if configured
	if h.s3 != nil && h.s3.IsConfigured() {
		f, err := file.Open()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to read uploaded file"})
		}
		defer f.Close()

		if err := h.s3.Upload(c.Context(), s3Key, f, file.Header.Get("Content-Type")); err != nil {
			log.Error().Err(err).Str("s3_key", s3Key).Msg("failed to upload to S3")
			return c.Status(500).JSON(fiber.Map{"error": "failed to upload file"})
		}
	}

	req := docSvc.CreateDocumentRequest{
		DocType:   docType,
		Filename:  sanitizedFilename,
		S3Key:     s3Key,
		MimeType:  file.Header.Get("Content-Type"),
		SizeBytes: file.Size,
		ExpiresAt: expiresAt,
		Notes:     notesPtr,
	}

	doc, err := h.svc.Create(c.Context(), tenantID, vehicleID, userID, req)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(201).JSON(doc)
}

// Delete DELETE /vehicles/:id/documents/:docId
func (h *Handler) Delete(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	vehicleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid vehicle id"})
	}

	docID, err := uuid.Parse(c.Params("docId"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid document id"})
	}

	if err := h.svc.Delete(c.Context(), tenantID, vehicleID, docID); err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.SendStatus(204)
}
