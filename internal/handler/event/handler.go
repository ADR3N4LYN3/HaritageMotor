package event

import (
	"time"

	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
	eventSvc "github.com/chriis/heritage-motor/internal/service/event"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Handler struct {
	svc *eventSvc.Service
}

func NewHandler(svc *eventSvc.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(r fiber.Router) {
	r.Get("/events", h.List)
	r.Get("/events/:id", h.GetByID)
	r.Post("/events", h.Create)
}

// List GET /events?vehicle_id=&type=&date_from=&date_to=&page=&per_page=
func (h *Handler) List(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	var pagination handler.PaginationParams
	if err := c.QueryParser(&pagination); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
	}
	pagination.Normalize()

	filters := eventSvc.EventFilters{
		Page:    pagination.Page,
		PerPage: pagination.PerPage,
	}

	if vid := c.Query("vehicle_id"); vid != "" {
		id, err := uuid.Parse(vid)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid vehicle_id"})
		}
		filters.VehicleID = &id
	}

	if et := c.Query("type"); et != "" {
		filters.EventType = &et
	}

	if df := c.Query("date_from"); df != "" {
		t, err := time.Parse(time.RFC3339, df)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid date_from, expected RFC3339"})
		}
		filters.DateFrom = &t
	}

	if dt := c.Query("date_to"); dt != "" {
		t, err := time.Parse(time.RFC3339, dt)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid date_to, expected RFC3339"})
		}
		filters.DateTo = &t
	}

	events, total, err := h.svc.List(c.Context(), tenantID, filters)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(handler.PaginatedResponse{
		Data:       events,
		TotalCount: total,
		Page:       filters.Page,
		PerPage:    filters.PerPage,
	})
}

// GetByID GET /events/:id
func (h *Handler) GetByID(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid event id"})
	}

	ev, err := h.svc.GetByID(c.Context(), tenantID, eventID)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(ev)
}

// Create POST /events
func (h *Handler) Create(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	var req eventSvc.CreateEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	ev, err := h.svc.Create(c.Context(), tenantID, userID, req)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(201).JSON(ev)
}
