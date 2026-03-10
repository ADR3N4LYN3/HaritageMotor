package photo

import (
	"encoding/base64"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/chriis/heritage-motor/internal/middleware"
	"github.com/chriis/heritage-motor/internal/storage"
)

type Handler struct {
	s3 *storage.S3Client
}

func NewHandler(s3Client *storage.S3Client) *Handler {
	return &Handler{s3: s3Client}
}

// GetSignedURL GET /photos/:key/signed-url
// The :key param is the S3 key encoded in base64url (since keys contain slashes).
func (h *Handler) GetSignedURL(c *fiber.Ctx) error {
	tenantID := middleware.TenantIDFromCtx(c)

	encodedKey := c.Params("key")
	if encodedKey == "" {
		return c.Status(400).JSON(fiber.Map{"error": "key is required"})
	}

	// Decode base64url-encoded S3 key
	keyBytes, err := base64.URLEncoding.DecodeString(encodedKey)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid key encoding, expected base64url"})
	}
	s3Key := string(keyBytes)

	// Security: verify the S3 key belongs to the current tenant
	// S3 keys follow the pattern: {tenant_id}/{resource_type}/{...}
	if !strings.HasPrefix(s3Key, tenantID.String()+"/") {
		return c.Status(403).JSON(fiber.Map{"error": "forbidden"})
	}

	if h.s3 == nil || !h.s3.IsConfigured() {
		return c.Status(503).JSON(fiber.Map{"error": "storage not configured"})
	}

	signedURL, err := h.s3.GetSignedURL(c.UserContext(), s3Key, 15*time.Minute)
	if err != nil {
		log.Error().Err(err).Str("s3_key", s3Key).Msg("failed to generate signed URL for photo")
		return c.Status(500).JSON(fiber.Map{"error": "failed to generate download URL"})
	}

	return c.JSON(fiber.Map{
		"signed_url": signedURL,
		"expires_in": 900,
	})
}
