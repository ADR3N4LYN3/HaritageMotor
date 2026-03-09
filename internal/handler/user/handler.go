package user

import (
	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
	userSvc "github.com/chriis/heritage-motor/internal/service/user"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Handler struct {
	svc *userSvc.Service
}

func NewHandler(svc *userSvc.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(r fiber.Router) {
	r.Get("/users", h.List)
	r.Post("/users", h.Create)
	r.Patch("/users/:id", h.Update)
	r.Delete("/users/:id", h.Delete)
}

// List GET /users
func (h *Handler) List(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	users, err := h.svc.List(c.Context(), tenantID)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(fiber.Map{"data": users})
}

// Create POST /users
func (h *Handler) Create(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	var req userSvc.CreateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	u, err := h.svc.Create(c.Context(), tenantID, req)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(201).JSON(u)
}

// Update PATCH /users/:id
func (h *Handler) Update(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid user id"})
	}

	var req userSvc.UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	u, err := h.svc.Update(c.Context(), tenantID, userID, req)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(u)
}

// Delete DELETE /users/:id
func (h *Handler) Delete(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid user id"})
	}

	if err := h.svc.Delete(c.Context(), tenantID, userID); err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.SendStatus(204)
}
