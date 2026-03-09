package db

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBTX is the common interface satisfied by *pgxpool.Pool, pgx.Tx, and *pgxpool.Conn.
// Services accept a DBTX so the tenant middleware can inject a transaction with
// SET LOCAL app.current_tenant_id already applied, enforcing RLS transparently.
type DBTX interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Begin(ctx context.Context) (pgx.Tx, error)
}

// compile-time checks
var (
	_ DBTX = (*pgxpool.Pool)(nil)
	_ DBTX = (pgx.Tx)(nil)
)

type txKey struct{}

// WithTx stores a pgx.Tx in the context. The tenant middleware uses this to
// inject the per-request transaction so services pick it up via Conn().
func WithTx(ctx context.Context, tx pgx.Tx) context.Context {
	return context.WithValue(ctx, txKey{}, tx)
}

// TxFromCtx extracts the transaction from context, if any.
func TxFromCtx(ctx context.Context) (pgx.Tx, bool) {
	tx, ok := ctx.Value(txKey{}).(pgx.Tx)
	return tx, ok
}

// Conn returns the DBTX to use: the middleware-injected transaction if present
// in context, otherwise the provided fallback (typically the pool).
// This is the single call-site every service/handler uses instead of s.pool.
func Conn(ctx context.Context, fallback DBTX) DBTX {
	if tx, ok := TxFromCtx(ctx); ok {
		return tx
	}
	return fallback
}
