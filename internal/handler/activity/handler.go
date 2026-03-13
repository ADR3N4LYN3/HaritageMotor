package activity

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/chriis/heritage-motor/internal/db"
	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
)

// Handler serves the activity feed for all authenticated tenant users.
type Handler struct {
	pool *pgxpool.Pool
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

type ActivityFilters struct {
	handler.PaginationParams
}

func (h *Handler) List(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	var filters ActivityFilters
	if err := c.QueryParser(&filters); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
	}
	filters.Normalize()
	if filters.PerPage > 30 {
		filters.PerPage = 30
	}

	query := `SELECT a.id::TEXT, a.action, a.resource_type, a.resource_id::TEXT,
		a.occurred_at,
		COALESCE(u.first_name, '') AS first_name,
		COALESCE(u.last_name, '') AS last_name,
		COUNT(*) OVER() AS total_count
		FROM audit_log a
		LEFT JOIN users u ON u.id = a.user_id
		WHERE a.tenant_id = $1
		ORDER BY a.occurred_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := db.Conn(c.UserContext(), h.pool).Query(c.UserContext(), query, tenantID, filters.PerPage, filters.Offset())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	var totalCount int
	entries := make([]fiber.Map, 0, filters.PerPage)
	for rows.Next() {
		var (
			id           string
			action       string
			resourceType string
			resourceID   *string
			occurredAt   time.Time
			firstName    string
			lastName     string
		)
		if err := rows.Scan(&id, &action, &resourceType, &resourceID, &occurredAt, &firstName, &lastName, &totalCount); err != nil {
			continue
		}
		entries = append(entries, fiber.Map{
			"id":            id,
			"action":        action,
			"resource_type": resourceType,
			"resource_id":   resourceID,
			"occurred_at":   occurredAt.Format(time.RFC3339),
			"user_name":     fmt.Sprintf("%s %s", firstName, lastName),
		})
	}

	return c.JSON(handler.PaginatedResponse{
		Data:       entries,
		TotalCount: totalCount,
		Page:       filters.Page,
		PerPage:    filters.PerPage,
	})
}
