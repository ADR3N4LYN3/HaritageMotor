package task

import (
	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
	taskservice "github.com/chriis/heritage-motor/internal/service/task"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type Handler struct {
	service *taskservice.Service
}

func NewHandler(service *taskservice.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r fiber.Router) {
	r.Get("/", h.List)
	r.Get("/:id", h.GetByID)
	r.Post("/", h.Create)
	r.Patch("/:id", h.Update)
	r.Post("/:id/complete", h.Complete)
	r.Delete("/:id", h.Delete)
}

type taskListQuery struct {
	handler.PaginationParams
	Status     string `query:"status"`
	VehicleID  string `query:"vehicle_id"`
	AssignedTo string `query:"assigned_to"`
}

func (h *Handler) List(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	var q taskListQuery
	if err := c.QueryParser(&q); err != nil {
		log.Warn().Err(err).Msg("invalid task list query params")
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
	}
	q.Normalize()

	filters := taskservice.TaskFilters{
		Status:  q.Status,
		Page:    q.Page,
		PerPage: q.PerPage,
	}

	if q.VehicleID != "" {
		id, err := uuid.Parse(q.VehicleID)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid vehicle_id"})
		}
		filters.VehicleID = &id
	}
	if q.AssignedTo != "" {
		id, err := uuid.Parse(q.AssignedTo)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid assigned_to"})
		}
		filters.AssignedTo = &id
	}

	tasks, total, err := h.service.List(c.Context(), tenantID, filters)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(handler.PaginatedResponse{
		Data:       tasks,
		TotalCount: total,
		Page:       q.Page,
		PerPage:    q.PerPage,
	})
}

func (h *Handler) GetByID(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	taskID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid task id"})
	}

	task, err := h.service.GetByID(c.Context(), tenantID, taskID)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(task)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	var req taskservice.CreateTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	task, err := h.service.Create(c.Context(), tenantID, req)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(201).JSON(task)
}

func (h *Handler) Update(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	taskID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid task id"})
	}

	var req taskservice.UpdateTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	task, err := h.service.Update(c.Context(), tenantID, taskID, req)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(task)
}

func (h *Handler) Complete(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	taskID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid task id"})
	}

	if err := h.service.Complete(c.Context(), tenantID, userID, taskID); err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(fiber.Map{"status": "completed"})
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	taskID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid task id"})
	}

	if err := h.service.Delete(c.Context(), tenantID, taskID); err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.SendStatus(204)
}
