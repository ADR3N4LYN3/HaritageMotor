package middleware

import (
	"github.com/chriis/heritage-motor/internal/domain"
	"github.com/gofiber/fiber/v2"
)

func RequireRole(roles ...string) fiber.Handler {
	roleSet := make(map[string]bool, len(roles))
	for _, r := range roles {
		roleSet[r] = true
	}

	return func(c *fiber.Ctx) error {
		role := RoleFromCtx(c)
		if !roleSet[role] {
			return c.Status(403).JSON(fiber.Map{"error": "forbidden"})
		}
		return c.Next()
	}
}

func RequireAdmin() fiber.Handler {
	return RequireRole(domain.RoleAdmin)
}

func RequireOperatorOrAbove() fiber.Handler {
	return RequireRole(domain.RoleAdmin, domain.RoleOperator)
}

func RequireTechnicianOrAbove() fiber.Handler {
	return RequireRole(domain.RoleAdmin, domain.RoleOperator, domain.RoleTechnician)
}
