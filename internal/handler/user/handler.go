package user

import (
	"context"
	"time"

	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
	plansvc "github.com/chriis/heritage-motor/internal/service/plan"
	userSvc "github.com/chriis/heritage-motor/internal/service/user"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type Handler struct {
	svc          *userSvc.Service
	ownerPool    *pgxpool.Pool
	accessExpiry time.Duration
	planSvc      *plansvc.Service
}

func NewHandler(svc *userSvc.Service, ownerPool *pgxpool.Pool, accessExpiry time.Duration, planSvc *plansvc.Service) *Handler {
	return &Handler{svc: svc, ownerPool: ownerPool, accessExpiry: accessExpiry, planSvc: planSvc}
}

// List GET /users
func (h *Handler) List(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	var params handler.PaginationParams
	if err := c.QueryParser(&params); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
	}
	params.Normalize()

	users, total, err := h.svc.List(c.UserContext(), tenantID, params.Page, params.PerPage)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.JSON(handler.PaginatedResponse{
		Data:       users,
		TotalCount: total,
		Page:       params.Page,
		PerPage:    params.PerPage,
	})
}

// Create POST /users
func (h *Handler) Create(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	// Plan gating: check user limit.
	if h.planSvc != nil {
		if err := h.planSvc.CheckLimitForTenant(c.UserContext(), tenantID, "users"); err != nil {
			return handler.HandleServiceError(c, err)
		}
	}

	var req userSvc.CreateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	u, err := h.svc.Create(c.UserContext(), tenantID, req)
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

	u, err := h.svc.Update(c.UserContext(), tenantID, userID, req)
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

	if err := h.svc.Delete(c.UserContext(), tenantID, userID); err != nil {
		return handler.HandleServiceError(c, err)
	}

	// Revoke all refresh tokens and blacklist access tokens for deleted user.
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		_, dbErr := h.ownerPool.Exec(bgCtx,
			`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
			userID,
		)
		if dbErr != nil {
			log.Error().Err(dbErr).Str("user_id", userID.String()).Msg("failed to revoke refresh tokens on user delete")
		}

		_, dbErr = h.ownerPool.Exec(bgCtx,
			`INSERT INTO token_blacklist (user_id, expires_at) VALUES ($1, $2)`,
			userID, time.Now().Add(h.accessExpiry),
		)
		if dbErr != nil {
			log.Error().Err(dbErr).Str("user_id", userID.String()).Msg("failed to blacklist user tokens on delete")
		}
	}()

	return c.SendStatus(204)
}
