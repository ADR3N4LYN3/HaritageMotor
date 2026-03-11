package auth

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/chriis/heritage-motor/internal/handler"
	"github.com/chriis/heritage-motor/internal/middleware"
	authservice "github.com/chriis/heritage-motor/internal/service/auth"
	"github.com/chriis/heritage-motor/internal/turnstile"
)

// Handler exposes HTTP endpoints for authentication and MFA.
type Handler struct {
	service   *authservice.Service
	turnstile *turnstile.Verifier
}

// NewHandler creates a new auth handler.
func NewHandler(service *authservice.Service, tv *turnstile.Verifier) *Handler {
	return &Handler{service: service, turnstile: tv}
}

// --- request DTOs ---

type loginRequest struct {
	Email             string `json:"email"                validate:"required,email"`
	Password          string `json:"password"             validate:"required,min=8"`
	TurnstileResponse string `json:"cf_turnstile_response"`
}

type verifyMFARequest struct {
	MFAToken string `json:"mfa_token" validate:"required"`
	Code     string `json:"code"      validate:"required,len=6"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type enableMFARequest struct {
	Code string `json:"code" validate:"required,len=6"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8"`
}

// Login handles POST /auth/login.
func (h *Handler) Login(c *fiber.Ctx) error {
	var req loginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	// Verify Turnstile token if provided (rate limiter protects login even without it)
	if req.TurnstileResponse != "" {
		if err := h.turnstile.Verify(c.UserContext(), req.TurnstileResponse, c.IP()); err != nil {
			return c.Status(403).JSON(fiber.Map{"error": "bot verification failed"})
		}
	}

	login, mfaPending, err := h.service.Login(c.UserContext(), req.Email, req.Password)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	if mfaPending != nil {
		return c.Status(200).JSON(fiber.Map{
			"mfa_required": true,
			"mfa_token":    mfaPending.MFAToken,
		})
	}

	return c.Status(200).JSON(fiber.Map{
		"access_token":  login.AccessToken,
		"refresh_token": login.RefreshToken,
		"user":          login.User,
	})
}

// VerifyMFA handles POST /auth/mfa/verify.
func (h *Handler) VerifyMFA(c *fiber.Ctx) error {
	var req verifyMFARequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	result, err := h.service.VerifyMFA(c.UserContext(), req.MFAToken, req.Code)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(200).JSON(fiber.Map{
		"access_token":  result.AccessToken,
		"refresh_token": result.RefreshToken,
		"user":          result.User,
	})
}

// Refresh handles POST /auth/refresh.
func (h *Handler) Refresh(c *fiber.Ctx) error {
	var req refreshRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	result, err := h.service.RefreshToken(c.UserContext(), req.RefreshToken)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(200).JSON(fiber.Map{
		"access_token":  result.AccessToken,
		"refresh_token": result.RefreshToken,
		"user":          result.User,
	})
}

// Logout handles POST /auth/logout.
func (h *Handler) Logout(c *fiber.Ctx) error {
	var req logoutRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	// Extract current access token's jti and expiry for blacklisting.
	jti := middleware.JTIFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	expiresAt := middleware.TokenExpiresAtFromCtx(c)

	if err := h.service.Logout(c.UserContext(), req.RefreshToken, jti, expiresAt); err != nil {
		return handler.HandleServiceError(c, err)
	}

	// Invalidate the blacklist cache so the next request sees the blacklisted token immediately.
	middleware.InvalidateBlacklistCache(jti, userID)

	return c.Status(200).JSON(fiber.Map{"message": "logged out"})
}

// GetMe handles GET /auth/me.
func (h *Handler) GetMe(c *fiber.Ctx) error {
	userID := middleware.UserIDFromCtx(c)
	tenantID := middleware.TenantIDFromCtx(c)

	user, err := h.service.GetMe(c.UserContext(), userID, tenantID)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(200).JSON(fiber.Map{"user": user})
}

// SetupMFA handles POST /auth/mfa/setup.
func (h *Handler) SetupMFA(c *fiber.Ctx) error {
	userID := middleware.UserIDFromCtx(c)
	tenantID := middleware.TenantIDFromCtx(c)

	result, err := h.service.SetupMFA(c.UserContext(), userID, tenantID)
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(200).JSON(fiber.Map{
		"secret": result.Secret,
		"url":    result.URL,
	})
}

// EnableMFA handles POST /auth/mfa/enable.
func (h *Handler) EnableMFA(c *fiber.Ctx) error {
	userID := middleware.UserIDFromCtx(c)
	tenantID := middleware.TenantIDFromCtx(c)

	var req enableMFARequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	if err := h.service.EnableMFA(c.UserContext(), userID, tenantID, req.Code); err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(200).JSON(fiber.Map{"message": "mfa enabled"})
}

// ChangePassword handles POST /auth/change-password.
func (h *Handler) ChangePassword(c *fiber.Ctx) error {
	userID := middleware.UserIDFromCtx(c)

	var req changePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	if err := h.service.ChangePassword(c.UserContext(), userID, req.CurrentPassword, req.NewPassword); err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(200).JSON(fiber.Map{"message": "password changed"})
}

// DisableMFA handles DELETE /auth/mfa?user_id=<uuid>.
// Admin-only: disables MFA for the specified user (or self if no user_id given).
func (h *Handler) DisableMFA(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	// Allow admin to target another user via query param
	targetUserID := middleware.UserIDFromCtx(c)
	if uid := c.Query("user_id"); uid != "" {
		parsed, err := uuid.Parse(uid)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid user_id"})
		}
		targetUserID = parsed
	}

	if err := h.service.DisableMFA(c.UserContext(), targetUserID, tenantID); err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(200).JSON(fiber.Map{"message": "mfa disabled"})
}
