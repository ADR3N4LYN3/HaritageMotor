package middleware

import (
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// UploadLimiterConfig controls the per-user bandwidth window.
type UploadLimiterConfig struct {
	MaxBytes int64         // max cumulative bytes per window per user
	Window   time.Duration // sliding window duration
}

type uploadEntry struct {
	bytes     int64
	windowEnd time.Time
}

// UploadLimiter restricts cumulative upload bandwidth per user over a time window.
// Uses Content-Length header for efficiency (no body buffering).
func UploadLimiter(cfg UploadLimiterConfig) fiber.Handler {
	var mu sync.Mutex
	entries := make(map[uuid.UUID]*uploadEntry)

	// Periodic cleanup of expired entries to prevent memory leak.
	go func() {
		ticker := time.NewTicker(cfg.Window)
		defer ticker.Stop()
		for range ticker.C {
			now := time.Now()
			mu.Lock()
			for k, e := range entries {
				if now.After(e.windowEnd) {
					delete(entries, k)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *fiber.Ctx) error {
		method := c.Method()
		if method != "POST" && method != "PUT" && method != "PATCH" {
			return c.Next()
		}

		contentLength := int64(c.Request().Header.ContentLength())
		if contentLength <= 0 {
			return c.Next()
		}

		userID := UserIDFromCtx(c)
		if userID == uuid.Nil {
			return c.Next()
		}

		mu.Lock()
		entry, ok := entries[userID]
		now := time.Now()
		if !ok || now.After(entry.windowEnd) {
			entry = &uploadEntry{bytes: 0, windowEnd: now.Add(cfg.Window)}
			entries[userID] = entry
		}
		entry.bytes += contentLength
		exceeded := entry.bytes > cfg.MaxBytes
		mu.Unlock()

		if exceeded {
			return c.Status(429).JSON(fiber.Map{"error": "upload bandwidth limit exceeded, try again later"})
		}

		return c.Next()
	}
}
