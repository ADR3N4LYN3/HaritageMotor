package bay

import (
	"fmt"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
	bayservice "github.com/chriis/heritage-motor/internal/service/bay"
	plansvc "github.com/chriis/heritage-motor/internal/service/plan"
)

type Handler struct {
	service *bayservice.Service
	planSvc *plansvc.Service
}

func NewHandler(service *bayservice.Service, planSvc *plansvc.Service) *Handler {
	return &Handler{service: service, planSvc: planSvc}
}

type listQuery struct {
	handler.PaginationParams
	Status string `query:"status"`
	Zone   string `query:"zone"`
}

func (h *Handler) List(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	var q listQuery
	if err := c.QueryParser(&q); err != nil {
		log.Warn().Err(err).Msg("invalid bay list query params")
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
	}
	q.Normalize()

	bays, total, err := h.service.List(c.UserContext(), tenantID, q.Status, q.Zone, q.Page, q.PerPage)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(handler.PaginatedResponse{
		Data:       bays,
		TotalCount: total,
		Page:       q.Page,
		PerPage:    q.PerPage,
	})
}

func (h *Handler) GetByID(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	bayID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid bay id"})
	}

	bay, err := h.service.GetByID(c.UserContext(), tenantID, bayID)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(bay)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	// Plan gating: check bay limit.
	if h.planSvc != nil {
		if err := h.planSvc.CheckLimitForTenant(c.UserContext(), tenantID, "bays"); err != nil {
			return handler.HandleServiceError(c, err)
		}
	}

	var req bayservice.CreateBayRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	bay, err := h.service.Create(c.UserContext(), tenantID, req)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(201).JSON(bay)
}

func (h *Handler) Update(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	bayID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid bay id"})
	}

	var req bayservice.UpdateBayRequest
	if err = c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	bay, err := h.service.Update(c.UserContext(), tenantID, bayID, req)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(bay)
}

// QRSheet GET /bays/qr-sheet — returns all bays with QR token URLs (admin only)
func (h *Handler) QRSheet(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	// Fetch all bays (high per_page, no filter)
	bays, _, err := h.service.List(c.UserContext(), tenantID, "", "", 1, 100)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	baseURL := os.Getenv("APP_BASE_URL")
	if baseURL == "" {
		baseURL = "https://app.heritagemotor.app"
	}

	type bayQR struct {
		ID      uuid.UUID `json:"id"`
		Code    string    `json:"code"`
		Zone    *string   `json:"zone,omitempty"`
		Status  string    `json:"status"`
		QRToken *string   `json:"qr_token,omitempty"`
		QRURL   string    `json:"qr_url"`
	}

	result := make([]bayQR, 0, len(bays))
	for _, b := range bays {
		qrURL := ""
		if b.QRToken != nil {
			qrURL = fmt.Sprintf("%s/scan/%s", baseURL, *b.QRToken)
		}
		result = append(result, bayQR{
			ID:      b.ID,
			Code:    b.Code,
			Zone:    b.Zone,
			Status:  b.Status,
			QRToken: b.QRToken,
			QRURL:   qrURL,
		})
	}

	return c.JSON(fiber.Map{"bays": result})
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	bayID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid bay id"})
	}

	if err := h.service.Delete(c.UserContext(), tenantID, bayID); err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.SendStatus(204)
}
