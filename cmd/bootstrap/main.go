package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"

	"github.com/chriis/heritage-motor/internal/auth"
	"github.com/chriis/heritage-motor/internal/domain"
)

func main() {
	// Load .env if present (local dev)
	_ = godotenv.Load() // optional, ignore error if no .env file

	email := mustEnv("SUPERADMIN_EMAIL")
	password := mustEnv("SUPERADMIN_PASSWORD")
	dbURL := mustEnv("DATABASE_URL")

	// Validate password strength
	if err := domain.ValidatePasswordStrength(password); err != nil {
		fmt.Fprintf(os.Stderr, "SUPERADMIN_PASSWORD invalid: %v\n", err)
		os.Exit(1)
	}

	// Hash with bcrypt cost 12
	hash, err := auth.HashPassword(password)
	if err != nil {
		fmt.Fprintf(os.Stderr, "hash error: %v\n", err)
		os.Exit(1)
	}

	// Single connection (one-shot command, no need for a pool)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "database connection failed: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(ctx) //nolint:errcheck // cleanup on exit

	// Conditional INSERT — the unique index is on (email, tenant_id) so
	// ON CONFLICT (email) won't match for tenant_id IS NULL.
	tag, err := conn.Exec(ctx, `
		INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, password_change_required)
		SELECT NULL, $1, $2, 'Super', 'Admin', 'superadmin'::user_role, false
		WHERE NOT EXISTS (
			SELECT 1 FROM users WHERE email = $1 AND tenant_id IS NULL AND deleted_at IS NULL
		)
	`, email, hash)
	if err != nil {
		fmt.Fprintf(os.Stderr, "insert failed: %v\n", err)
		os.Exit(1)
	}

	if tag.RowsAffected() == 0 {
		fmt.Printf("Superadmin %s already exists — nothing to do.\n", email)
	} else {
		fmt.Printf("Superadmin %s created successfully.\n", email)
	}
}

func mustEnv(key string) string {
	val := os.Getenv(key)
	if val == "" {
		fmt.Fprintf(os.Stderr, "required environment variable %s is not set\n", key)
		os.Exit(1)
	}
	return val
}
