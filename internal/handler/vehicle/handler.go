package vehicle

import (
	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
	vehiclesvc "github.com/chriis/heritage-motor/internal/service/vehicle"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Handler holds the HTTP handlers for vehicle endpoints.
type Handler struct {
	svc *vehiclesvc.Service
}

// NewHandler creates a new vehicle handler.
func NewHandler(svc *vehiclesvc.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all vehicle routes on the given router group.
func (h *Handler) RegisterRoutes(r fiber.Router) {
	r.Get("/vehicles", h.List)
	r.Get("/vehicles/:id", h.GetByID)
	r.Post("/vehicles", h.Create)
	r.Patch("/vehicles/:id", h.Update)
	r.Delete("/vehicles/:id", h.Delete)
	r.Post("/vehicles/:id/move", h.Move)
	r.Post("/vehicles/:id/exit", h.Exit)
	r.Get("/vehicles/:id/timeline", h.GetTimeline)
}

// listQuery maps query parameters for the List endpoint.
type listQuery struct {
	Status  string `query:"status"`
	Search  string `query:"search"`
	BayID   string `query:"bay_id"`
	Page    int    `query:"page"`
	PerPage int    `query:"per_page"`
}

// List handles GET /vehicles
func (h *Handler) List(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	var q listQuery
	if err := c.QueryParser(&q); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
	}

	filters := vehiclesvc.VehicleFilters{
		Status:  q.Status,
		Search:  q.Search,
		Page:    q.Page,
		PerPage: q.PerPage,
	}

	if q.BayID != "" {
		bayUUID, err := uuid.Parse(q.BayID)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid bay_id"})
		}
		filters.BayID = &bayUUID
	}

	vehicles, total, err := h.svc.List(c.Context(), tenantID, filters)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	// Normalize pagination values for response.
	page := filters.Page
	if page < 1 {
		page = 1
	}
	perPage := filters.PerPage
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	return c.JSON(handler.PaginatedResponse{
		Data:       vehicles,
		TotalCount: total,
		Page:       page,
		PerPage:    perPage,
	})
}

// GetByID handles GET /vehicles/:id
func (h *Handler) GetByID(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)
	vehicleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid vehicle id"})
	}

	vehicle, err := h.svc.GetByID(c.Context(), tenantID, vehicleID)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(vehicle)
}

// createRequest is the JSON body for creating a vehicle.
type createRequest struct {
	Make         string     `json:"make" validate:"required"`
	Model        string     `json:"model" validate:"required"`
	Year         *int       `json:"year,omitempty"`
	Color        *string    `json:"color,omitempty"`
	LicensePlate *string    `json:"license_plate,omitempty"`
	VIN          *string    `json:"vin,omitempty"`
	OwnerName    string     `json:"owner_name" validate:"required"`
	OwnerEmail   *string    `json:"owner_email,omitempty" validate:"omitempty,email"`
	OwnerPhone   *string    `json:"owner_phone,omitempty"`
	OwnerNotes   *string    `json:"owner_notes,omitempty"`
	Notes        *string    `json:"notes,omitempty"`
	Tags         []string   `json:"tags,omitempty"`
	BayID        *uuid.UUID `json:"bay_id,omitempty"`
}

// Create handles POST /vehicles
func (h *Handler) Create(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	var req createRequest
	if err := c.BodyParser(&req); err != nil {
		log.Warn().Err(err).Msg("invalid create vehicle body")
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	svcReq := vehiclesvc.CreateVehicleRequest{
		Make:         req.Make,
		Model:        req.Model,
		Year:         req.Year,
		Color:        req.Color,
		LicensePlate: req.LicensePlate,
		VIN:          req.VIN,
		OwnerName:    req.OwnerName,
		OwnerEmail:   req.OwnerEmail,
		OwnerPhone:   req.OwnerPhone,
		OwnerNotes:   req.OwnerNotes,
		Notes:        req.Notes,
		Tags:         req.Tags,
		BayID:        req.BayID,
	}

	vehicle, err := h.svc.Create(c.Context(), tenantID, userID, svcReq)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(201).JSON(vehicle)
}

// updateRequest is the JSON body for updating a vehicle.
type updateRequest struct {
	Make         *string  `json:"make,omitempty"`
	Model        *string  `json:"model,omitempty"`
	Year         *int     `json:"year,omitempty"`
	Color        *string  `json:"color,omitempty"`
	LicensePlate *string  `json:"license_plate,omitempty"`
	VIN          *string  `json:"vin,omitempty"`
	OwnerName    *string  `json:"owner_name,omitempty"`
	OwnerEmail   *string  `json:"owner_email,omitempty" validate:"omitempty,email"`
	OwnerPhone   *string  `json:"owner_phone,omitempty"`
	OwnerNotes   *string  `json:"owner_notes,omitempty"`
	Status       *string  `json:"status,omitempty"`
	Notes        *string  `json:"notes,omitempty"`
	Tags         []string `json:"tags,omitempty"`
}

// Update handles PATCH /vehicles/:id
func (h *Handler) Update(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)
	vehicleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid vehicle id"})
	}

	var req updateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	svcReq := vehiclesvc.UpdateVehicleRequest{
		Make:         req.Make,
		Model:        req.Model,
		Year:         req.Year,
		Color:        req.Color,
		LicensePlate: req.LicensePlate,
		VIN:          req.VIN,
		OwnerName:    req.OwnerName,
		OwnerEmail:   req.OwnerEmail,
		OwnerPhone:   req.OwnerPhone,
		OwnerNotes:   req.OwnerNotes,
		Status:       req.Status,
		Notes:        req.Notes,
		Tags:         req.Tags,
	}

	vehicle, err := h.svc.Update(c.Context(), tenantID, vehicleID, svcReq)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(vehicle)
}

// Delete handles DELETE /vehicles/:id
func (h *Handler) Delete(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)
	vehicleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid vehicle id"})
	}

	if err := h.svc.Delete(c.Context(), tenantID, vehicleID); err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.SendStatus(204)
}

// moveRequest is the JSON body for moving a vehicle.
type moveRequest struct {
	BayID  uuid.UUID `json:"bay_id" validate:"required"`
	Reason string    `json:"reason,omitempty"`
}

// Move handles POST /vehicles/:id/move
func (h *Handler) Move(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	vehicleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid vehicle id"})
	}

	var req moveRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	if err := h.svc.Move(c.Context(), tenantID, userID, vehicleID, req.BayID, req.Reason); err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(fiber.Map{"status": "moved"})
}

// exitRequest is the JSON body for exiting a vehicle.
type exitRequest struct {
	Notes string `json:"notes,omitempty"`
}

// Exit handles POST /vehicles/:id/exit
func (h *Handler) Exit(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	vehicleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid vehicle id"})
	}

	var req exitRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if err := h.svc.Exit(c.Context(), tenantID, userID, vehicleID, req.Notes); err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(fiber.Map{"status": "exited"})
}

// GetTimeline handles GET /vehicles/:id/timeline
func (h *Handler) GetTimeline(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)
	vehicleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid vehicle id"})
	}

	var pag handler.PaginationParams
	if err := c.QueryParser(&pag); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
	}
	pag.Normalize()

	events, total, err := h.svc.GetTimeline(c.Context(), tenantID, vehicleID, pag.Page, pag.PerPage)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(handler.PaginatedResponse{
		Data:       events,
		TotalCount: total,
		Page:       pag.Page,
		PerPage:    pag.PerPage,
	})
}
