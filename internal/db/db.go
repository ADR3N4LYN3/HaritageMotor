package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// NewPool creates a connection pool for the owner role (migrations, auth, audit).
func NewPool(databaseURL string) (*pgxpool.Pool, error) {
	return newPool(databaseURL, 25, 5, "owner")
}

// NewAppPool creates a connection pool for the application role (RLS enforced).
// Uses slightly fewer connections since the owner pool also consumes some.
func NewAppPool(databaseURL string) (*pgxpool.Pool, error) {
	return newPool(databaseURL, 20, 3, "app")
}

func newPool(databaseURL string, maxConns, minConns int32, label string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}

	config.MaxConns = maxConns
	config.MinConns = minConns
	config.MaxConnLifetime = 2 * time.Hour
	config.MaxConnIdleTime = 5 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create %s pool: %w", label, err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping %s database: %w", label, err)
	}

	log.Info().Str("role", label).Msg("database connection pool established")
	return pool, nil
}
