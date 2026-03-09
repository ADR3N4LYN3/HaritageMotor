package bay

import (
	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
	bayservice "github.com/chriis/heritage-motor/internal/service/bay"
	plansvc "github.com/chriis/heritage-motor/internal/service/plan"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
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
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	bay, err := h.service.Update(c.UserContext(), tenantID, bayID, req)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(bay)
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
