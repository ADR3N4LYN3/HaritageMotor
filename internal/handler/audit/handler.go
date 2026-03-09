package audit

import (
	"fmt"

	"github.com/chriis/heritage-motor/internal/db"
	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	pool *pgxpool.Pool
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

type AuditFilters struct {
	handler.PaginationParams
	UserID       string `query:"user_id"`
	ResourceType string `query:"resource_type"`
	DateFrom     string `query:"date_from"`
	DateTo       string `query:"date_to"`
}

func (h *Handler) List(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	var filters AuditFilters
	if err := c.QueryParser(&filters); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
	}
	filters.Normalize()

	// Single query with COUNT(*) OVER() — avoids a separate COUNT(*) round-trip.
	query := `SELECT id, tenant_id, user_id, action, resource_type, resource_id,
		old_values, new_values, ip_address, user_agent, request_id, occurred_at,
		COUNT(*) OVER() AS total_count
		FROM audit_log WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filters.UserID != "" {
		query += ` AND user_id = $` + itoa(argIdx)
		args = append(args, filters.UserID)
		argIdx++
	}
	if filters.ResourceType != "" {
		query += ` AND resource_type = $` + itoa(argIdx)
		args = append(args, filters.ResourceType)
		argIdx++
	}
	if filters.DateFrom != "" {
		query += ` AND occurred_at >= $` + itoa(argIdx)
		args = append(args, filters.DateFrom)
		argIdx++
	}
	if filters.DateTo != "" {
		query += ` AND occurred_at <= $` + itoa(argIdx)
		args = append(args, filters.DateTo)
		argIdx++
	}

	query += ` ORDER BY occurred_at DESC LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, filters.PerPage, filters.Offset())

	rows, err := db.Conn(c.UserContext(), h.pool).Query(c.UserContext(), query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "database error"})
	}
	defer rows.Close()

	var totalCount int
	entries := make([]fiber.Map, 0, filters.PerPage)
	for rows.Next() {
		var entry struct {
			ID           string
			TenantID     string
			UserID       *string
			Action       string
			ResourceType string
			ResourceID   *string
			OldValues    *[]byte
			NewValues    *[]byte
			IPAddress    *string
			UserAgent    *string
			RequestID    *string
			OccurredAt   string
		}
		err := rows.Scan(
			&entry.ID, &entry.TenantID, &entry.UserID, &entry.Action,
			&entry.ResourceType, &entry.ResourceID, &entry.OldValues,
			&entry.NewValues, &entry.IPAddress, &entry.UserAgent,
			&entry.RequestID, &entry.OccurredAt,
			&totalCount,
		)
		if err != nil {
			continue
		}
		entries = append(entries, fiber.Map{
			"id":            entry.ID,
			"tenant_id":     entry.TenantID,
			"user_id":       entry.UserID,
			"action":        entry.Action,
			"resource_type": entry.ResourceType,
			"resource_id":   entry.ResourceID,
			"ip_address":    entry.IPAddress,
			"request_id":    entry.RequestID,
			"occurred_at":   entry.OccurredAt,
		})
	}

	return c.JSON(handler.PaginatedResponse{
		Data:       entries,
		TotalCount: totalCount,
		Page:       filters.Page,
		PerPage:    filters.PerPage,
	})
}

func itoa(n int) string {
	return fmt.Sprintf("%d", n)
}
