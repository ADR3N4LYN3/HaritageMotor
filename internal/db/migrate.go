package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// RunMigrations executes all .up.sql files from migrationsDir in order,
// tracking applied migrations in a schema_migrations table.
func RunMigrations(pool *pgxpool.Pool, migrationsDir string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Create tracking table
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`); err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	// Get already applied migrations
	rows, err := pool.Query(ctx, "SELECT version FROM schema_migrations ORDER BY version")
	if err != nil {
		return fmt.Errorf("query applied migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil { //nolint:govet // shadow in limited if-scope is intentional
			return fmt.Errorf("scan migration version: %w", err)
		}
		applied[v] = true
	}
	if err := rows.Err(); err != nil { //nolint:govet // shadow in limited if-scope is intentional
		return fmt.Errorf("iterate migrations: %w", err)
	}

	// Find .up.sql files
	files, err := filepath.Glob(filepath.Join(migrationsDir, "*.up.sql"))
	if err != nil {
		return fmt.Errorf("glob migrations: %w", err)
	}
	sort.Strings(files)

	if len(files) == 0 {
		log.Warn().Str("dir", migrationsDir).Msg("no migration files found")
		return nil
	}

	// Apply pending migrations
	count := 0
	for _, file := range files {
		name := strings.TrimSuffix(filepath.Base(file), ".up.sql")
		if applied[name] {
			continue
		}

		sqlBytes, err := os.ReadFile(file)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}

		sqlContent := string(sqlBytes)
		noTx := strings.HasPrefix(strings.TrimSpace(sqlContent), "-- no-transaction")

		if noTx {
			// Execute without transaction (required for ALTER TYPE ADD VALUE).
			if _, err := pool.Exec(ctx, sqlContent); err != nil {
				return fmt.Errorf("execute migration %s: %w", name, err)
			}
			if _, err := pool.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", name); err != nil {
				return fmt.Errorf("record migration %s: %w", name, err)
			}
		} else {
			tx, err := pool.Begin(ctx)
			if err != nil {
				return fmt.Errorf("begin tx for %s: %w", name, err)
			}

			if _, err := tx.Exec(ctx, sqlContent); err != nil {
				_ = tx.Rollback(ctx)
				return fmt.Errorf("execute migration %s: %w", name, err)
			}

			if _, err := tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", name); err != nil {
				_ = tx.Rollback(ctx)
				return fmt.Errorf("record migration %s: %w", name, err)
			}

			if err := tx.Commit(ctx); err != nil {
				return fmt.Errorf("commit migration %s: %w", name, err)
			}
		}

		log.Info().Str("migration", name).Msg("applied")
		count++
	}

	if count == 0 {
		log.Info().Msg("database is up to date")
	} else {
		log.Info().Int("count", count).Msg("migrations applied")
	}

	return nil
}
