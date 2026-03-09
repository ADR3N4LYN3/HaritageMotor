package plan

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/chriis/heritage-motor/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type cachedLimits struct {
	limits    map[string]map[string]int // plan -> resource -> max_count
	loadedAt  time.Time
}

// Service provides plan limit checking with an in-memory cache.
type Service struct {
	pool  *pgxpool.Pool
	mu    sync.RWMutex
	cache *cachedLimits
	ttl   time.Duration
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{
		pool: pool,
		ttl:  5 * time.Minute,
	}
}

// loadLimits fetches all plan limits from DB and caches them.
func (s *Service) loadLimits(ctx context.Context) (map[string]map[string]int, error) {
	s.mu.RLock()
	if s.cache != nil && time.Since(s.cache.loadedAt) < s.ttl {
		defer s.mu.RUnlock()
		return s.cache.limits, nil
	}
	s.mu.RUnlock()

	s.mu.Lock()
	defer s.mu.Unlock()

	// Double-check after acquiring write lock.
	if s.cache != nil && time.Since(s.cache.loadedAt) < s.ttl {
		return s.cache.limits, nil
	}

	rows, err := s.pool.Query(ctx, `SELECT plan, resource, max_count FROM plan_limits`)
	if err != nil {
		return nil, fmt.Errorf("query plan_limits: %w", err)
	}
	defer rows.Close()

	limits := make(map[string]map[string]int)
	for rows.Next() {
		var pl domain.PlanLimit
		if err := rows.Scan(&pl.Plan, &pl.Resource, &pl.MaxCount); err != nil {
			return nil, fmt.Errorf("scan plan_limit: %w", err)
		}
		if limits[pl.Plan] == nil {
			limits[pl.Plan] = make(map[string]int)
		}
		limits[pl.Plan][pl.Resource] = pl.MaxCount
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate plan_limits: %w", err)
	}

	s.cache = &cachedLimits{limits: limits, loadedAt: time.Now()}
	return limits, nil
}

// CheckLimit verifies that the tenant hasn't exceeded the limit for a given resource.
// Returns nil if within limits, or ErrPlanLimitReached if exceeded.
// Uses the ownerPool (no RLS) to count across the tenant.
func (s *Service) CheckLimit(ctx context.Context, tenantID uuid.UUID, plan, resource string) error {
	limits, err := s.loadLimits(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to load plan limits — allowing request")
		return nil // fail-open
	}

	planLimits, ok := limits[plan]
	if !ok {
		return nil // unknown plan = no limits
	}

	maxCount, ok := planLimits[resource]
	if !ok {
		return nil // no limit for this resource
	}
	if maxCount < 0 {
		return nil // -1 = unlimited
	}

	// Count current resources for this tenant.
	var table, condition string
	switch resource {
	case "vehicles":
		table = "vehicles"
		condition = "tenant_id = $1 AND deleted_at IS NULL"
	case "users":
		table = "users"
		condition = "tenant_id = $1 AND deleted_at IS NULL"
	case "bays":
		table = "bays"
		condition = "tenant_id = $1"
	default:
		return nil
	}

	var count int
	err = s.pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE %s`, table, condition),
		tenantID,
	).Scan(&count)
	if err != nil {
		log.Error().Err(err).Str("resource", resource).Msg("failed to count resources — allowing request")
		return nil // fail-open
	}

	if count >= maxCount {
		return &domain.ErrPlanLimitReached{Resource: resource, Limit: maxCount}
	}

	return nil
}

// CheckLimitForTenant looks up the tenant's plan and checks the limit.
// This is the main entry point for handlers.
func (s *Service) CheckLimitForTenant(ctx context.Context, tenantID uuid.UUID, resource string) error {
	var plan string
	err := s.pool.QueryRow(ctx,
		`SELECT plan FROM tenants WHERE id = $1 AND deleted_at IS NULL`, tenantID,
	).Scan(&plan)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID.String()).Msg("failed to lookup tenant plan — allowing request")
		return nil // fail-open
	}
	return s.CheckLimit(ctx, tenantID, plan, resource)
}
