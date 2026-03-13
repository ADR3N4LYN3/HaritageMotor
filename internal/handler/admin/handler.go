package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
	adminsvc "github.com/chriis/heritage-motor/internal/service/admin"
)

type Handler struct {
	service *adminsvc.Service
}

func NewHandler(service *adminsvc.Service) *Handler {
	return &Handler{service: service}
}

// DashboardStats returns global stats for the superadmin dashboard.
func (h *Handler) DashboardStats(c *fiber.Ctx) error {
	stats, err := h.service.GetDashboardStats(c.UserContext())
	if err != nil {
		return handler.HandleServiceError(c, err)
	}
	return c.JSON(stats)
}

// ListTenants returns all tenants with resource counts.
func (h *Handler) ListTenants(c *fiber.Ctx) error {
	var p handler.PaginationParams
	if err := c.QueryParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
	}
	p.Normalize()

	tenants, total, err := h.service.ListTenants(c.UserContext(), p.Page, p.PerPage)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(handler.PaginatedResponse{
		Data:       tenants,
		TotalCount: total,
		Page:       p.Page,
		PerPage:    p.PerPage,
	})
}

// GetTenant returns a single tenant with stats.
func (h *Handler) GetTenant(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid tenant ID"})
	}

	tenant, svcErr := h.service.GetTenant(c.UserContext(), id)
	if svcErr != nil {
		return handler.HandleServiceError(c, svcErr)
	}
	return c.JSON(tenant)
}

// CreateTenant creates a new tenant.
func (h *Handler) CreateTenant(c *fiber.Ctx) error {
	var req adminsvc.CreateTenantRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	tenant, err := h.service.CreateTenant(c.UserContext(), req)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}
	return c.Status(201).JSON(tenant)
}

// UpdateTenant updates a tenant.
func (h *Handler) UpdateTenant(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid tenant ID"})
	}

	var req adminsvc.UpdateTenantRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenant, svcErr := h.service.UpdateTenant(c.UserContext(), id, req)
	if svcErr != nil {
		return handler.HandleServiceError(c, svcErr)
	}
	return c.JSON(tenant)
}

// DeleteTenant soft-deletes a tenant.
func (h *Handler) DeleteTenant(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid tenant ID"})
	}

	if svcErr := h.service.DeleteTenant(c.UserContext(), id); svcErr != nil {
		return handler.HandleServiceError(c, svcErr)
	}
	return c.SendStatus(204)
}

// ListTenantUsers returns users belonging to a specific tenant.
func (h *Handler) ListTenantUsers(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid tenant ID"})
	}

	var p handler.PaginationParams
	if err := c.QueryParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
	}
	p.Normalize()

	users, total, svcErr := h.service.ListTenantUsers(c.UserContext(), id, p.Page, p.PerPage)
	if svcErr != nil {
		return handler.HandleServiceError(c, svcErr)
	}
	return c.JSON(handler.PaginatedResponse{
		Data:       users,
		TotalCount: total,
		Page:       p.Page,
		PerPage:    p.PerPage,
	})
}

// ListTenantVehicles returns vehicles belonging to a specific tenant.
func (h *Handler) ListTenantVehicles(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid tenant ID"})
	}

	var p handler.PaginationParams
	if err := c.QueryParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
	}
	p.Normalize()

	vehicles, total, svcErr := h.service.ListTenantVehicles(c.UserContext(), id, p.Page, p.PerPage)
	if svcErr != nil {
		return handler.HandleServiceError(c, svcErr)
	}
	return c.JSON(handler.PaginatedResponse{
		Data:       vehicles,
		TotalCount: total,
		Page:       p.Page,
		PerPage:    p.PerPage,
	})
}

// InviteUser creates a user with temp password and sends welcome email.
func (h *Handler) InviteUser(c *fiber.Ctx) error {
	var req adminsvc.InviteUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	invitedBy := middleware.UserIDFromCtx(c)
	user, err := h.service.InviteUser(c.UserContext(), invitedBy, req)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}
	return c.Status(201).JSON(user)
}
