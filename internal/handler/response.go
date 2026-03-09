package handler

import (
	"github.com/chriis/heritage-motor/internal/domain"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

var Validate = validator.New()

func HandleServiceError(c *fiber.Ctx, err error) error {
	switch e := err.(type) {
	case *domain.ErrNotFound:
		return c.Status(404).JSON(fiber.Map{"error": "not_found", "resource": e.Resource})
	case *domain.ErrForbidden:
		return c.Status(403).JSON(fiber.Map{"error": "forbidden"})
	case *domain.ErrValidation:
		return c.Status(422).JSON(fiber.Map{"error": "validation", "field": e.Field, "message": e.Message})
	case *domain.ErrConflict:
		return c.Status(409).JSON(fiber.Map{"error": "conflict", "message": e.Message})
	case *domain.ErrUnauthorized:
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized", "message": e.Message})
	case *domain.ErrPlanLimitReached:
		return c.Status(402).JSON(fiber.Map{"error": "plan_limit", "resource": e.Resource, "limit": e.Limit})
	case *domain.ErrTenantSuspended:
		return c.Status(403).JSON(fiber.Map{"error": "tenant_suspended"})
	default:
		log.Error().Err(err).Msg("unhandled service error")
		return c.Status(500).JSON(fiber.Map{"error": "internal"})
	}
}

func ValidationError(err error) fiber.Map {
	errors := make([]fiber.Map, 0)
	if ve, ok := err.(validator.ValidationErrors); ok {
		for _, fe := range ve {
			errors = append(errors, fiber.Map{
				"field":   fe.Field(),
				"tag":     fe.Tag(),
				"message": fe.Error(),
			})
		}
	}
	return fiber.Map{"error": "validation", "details": errors}
}

type PaginationParams struct {
	Page    int `query:"page"`
	PerPage int `query:"per_page"`
}

func (p *PaginationParams) Normalize() {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PerPage < 1 || p.PerPage > 100 {
		p.PerPage = 20
	}
}

func (p *PaginationParams) Offset() int {
	return (p.Page - 1) * p.PerPage
}

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	TotalCount int         `json:"total_count"`
	Page       int         `json:"page"`
	PerPage    int         `json:"per_page"`
}
