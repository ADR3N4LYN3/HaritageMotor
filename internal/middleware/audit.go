package middleware

import (
	"context"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// auditEntry holds all values captured from the request context
// BEFORE launching the goroutine — Fiber reuses *fiber.Ctx after handler return.
type auditEntry struct {
	tenantID  uuid.UUID
	userID    uuid.UUID
	method    string
	path      string
	ip        string
	userAgent string
	requestID string
}

func AuditMiddleware(pool *pgxpool.Pool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Generate request ID and propagate into Go context
		requestID := uuid.New().String()
		c.Locals(string(RequestIDKey), requestID)
		c.Set("X-Request-ID", requestID)

		// Inject request_id into Go context so services and zerolog can use it
		ctx := context.WithValue(c.Context(), RequestIDKey, requestID)
		c.SetUserContext(ctx)

		err := c.Next()

		// Only audit mutating requests
		method := c.Method()
		if method == "GET" || method == "HEAD" || method == "OPTIONS" {
			return err
		}

		// Skip auth routes from audit
		path := c.Path()
		if strings.HasPrefix(path, "/api/v1/auth/") && !strings.HasSuffix(path, "/me") {
			return err
		}

		// Capture ALL values from the context BEFORE launching the goroutine.
		entry := auditEntry{
			tenantID:  TenantIDFromCtx(c),
			userID:    UserIDFromCtx(c),
			method:    method,
			path:      path,
			ip:        c.IP(),
			userAgent: c.Get("User-Agent"),
			requestID: requestID,
		}

		go logAudit(pool, entry)

		return err
	}
}

func logAudit(pool *pgxpool.Pool, e auditEntry) {
	defer func() {
		if r := recover(); r != nil {
			log.Error().Interface("panic", r).Str("request_id", e.requestID).Msg("panic in audit goroutine")
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	action := deriveAction(e.method, e.path)
	resourceType, resourceID := deriveResource(e.path)

	var userIDPtr *uuid.UUID
	if e.userID != uuid.Nil {
		userIDPtr = &e.userID
	}
	var resourceIDPtr *uuid.UUID
	if resourceID != uuid.Nil {
		resourceIDPtr = &resourceID
	}

	_, dbErr := pool.Exec(ctx,
		`INSERT INTO audit_log (tenant_id, user_id, action, resource_type, resource_id, ip_address, user_agent, request_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		e.tenantID, userIDPtr, action, resourceType, resourceIDPtr, e.ip, e.userAgent, e.requestID,
	)
	if dbErr != nil {
		log.Error().Err(dbErr).Str("action", action).Msg("failed to write audit log")
	}
}

func deriveAction(method, path string) string {
	parts := strings.Split(strings.TrimPrefix(path, "/api/v1/"), "/")
	resource := ""
	if len(parts) > 0 {
		resource = parts[0]
	}

	// Handle special actions
	if len(parts) >= 3 {
		lastPart := parts[len(parts)-1]
		switch lastPart {
		case "move":
			return resource + ".move"
		case "exit":
			return resource + ".exit"
		case "complete":
			return resource + ".complete"
		case "photos":
			return "photo.upload"
		case "documents":
			if method == "POST" {
				return "document.upload"
			}
		}
	}

	switch method {
	case "POST":
		return resource + ".create"
	case "PATCH", "PUT":
		return resource + ".update"
	case "DELETE":
		return resource + ".delete"
	default:
		return resource + "." + strings.ToLower(method)
	}
}

func deriveResource(path string) (string, uuid.UUID) {
	parts := strings.Split(strings.TrimPrefix(path, "/api/v1/"), "/")
	resourceType := ""
	resourceID := uuid.Nil

	if len(parts) > 0 {
		resourceType = strings.TrimSuffix(parts[0], "s") // vehicles -> vehicle
	}
	if len(parts) > 1 {
		if id, err := uuid.Parse(parts[1]); err == nil {
			resourceID = id
		}
	}

	return resourceType, resourceID
}
