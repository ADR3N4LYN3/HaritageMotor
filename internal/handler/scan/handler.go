package scan

import (
	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	pool *pgxpool.Pool
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

type scanResult struct {
	EntityType string   `json:"entity_type"`
	EntityID   string   `json:"entity_id"`
	EntityName string   `json:"entity_name"`
	Actions    []string `json:"actions"`
}

// Resolve handles GET /api/v1/scan/:token
func (h *Handler) Resolve(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)
	role := middleware.RoleFromCtx(c)
	token := c.Params("token")

	if token == "" {
		return c.Status(400).JSON(fiber.Map{"error": "token is required"})
	}

	// Try vehicles first
	var vehicleID uuid.UUID
	var make, model string
	err := h.pool.QueryRow(c.Context(),
		"SELECT id, make, model FROM vehicles WHERE qr_token = $1 AND tenant_id = $2 AND deleted_at IS NULL",
		token, tenantID,
	).Scan(&vehicleID, &make, &model)
	if err == nil {
		actions := resolveVehicleActions(role)
		return c.JSON(scanResult{
			EntityType: "vehicle",
			EntityID:   vehicleID.String(),
			EntityName: make + " " + model,
			Actions:    actions,
		})
	}
	if err != pgx.ErrNoRows {
		return handler.HandleServiceError(c, err)
	}

	// Try bays
	var bayID uuid.UUID
	var code string
	err = h.pool.QueryRow(c.Context(),
		"SELECT id, code FROM bays WHERE qr_token = $1 AND tenant_id = $2",
		token, tenantID,
	).Scan(&bayID, &code)
	if err == nil {
		return c.JSON(scanResult{
			EntityType: "bay",
			EntityID:   bayID.String(),
			EntityName: code,
			Actions:    []string{},
		})
	}
	if err != pgx.ErrNoRows {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(404).JSON(fiber.Map{"error": "not_found", "message": "QR token not recognized"})
}

func resolveVehicleActions(role string) []string {
	switch role {
	case "admin", "operator":
		return []string{"move", "task", "photo", "exit"}
	case "technician":
		return []string{"task", "photo"}
	default:
		return []string{}
	}
}
