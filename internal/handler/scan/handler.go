package scan

import (
	"github.com/chriis/heritage-motor/internal/db"
	"github.com/chriis/heritage-motor/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
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
// Uses a single UNION ALL query to check both vehicles and bays.
func (h *Handler) Resolve(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)
	role := middleware.RoleFromCtx(c)
	token := c.Params("token")

	if token == "" {
		return c.Status(400).JSON(fiber.Map{"error": "token is required"})
	}

	// Single query: check vehicles and bays in one round-trip.
	var entityType, entityID, entityName string
	err := db.Conn(c.UserContext(), h.pool).QueryRow(c.UserContext(),
		`SELECT entity_type, id, name FROM (
			SELECT 'vehicle' AS entity_type, id::text, make || ' ' || model AS name
			FROM vehicles
			WHERE qr_token = $1 AND tenant_id = $2 AND deleted_at IS NULL
			UNION ALL
			SELECT 'bay' AS entity_type, id::text, code AS name
			FROM bays
			WHERE qr_token = $1 AND tenant_id = $2
		) sub LIMIT 1`,
		token, tenantID,
	).Scan(&entityType, &entityID, &entityName)
	if err != nil {
		if err == pgx.ErrNoRows {
			return c.Status(404).JSON(fiber.Map{"error": "not_found", "message": "QR token not recognized"})
		}
		log.Error().Err(err).Str("token", token).Msg("scan query failed")
		return c.Status(500).JSON(fiber.Map{"error": "internal"})
	}

	var actions []string
	if entityType == "vehicle" {
		actions = resolveVehicleActions(role)
	} else {
		actions = []string{}
	}

	return c.JSON(scanResult{
		EntityType: entityType,
		EntityID:   entityID,
		EntityName: entityName,
		Actions:    actions,
	})
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
