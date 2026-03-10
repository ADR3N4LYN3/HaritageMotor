package db_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/chriis/heritage-motor/internal/testutil"
)

// countRows begins a tx on AppPool, sets the tenant context, and returns the row count for the table.
func countRows(t *testing.T, env *testutil.Env, tenantID uuid.UUID, table string) int {
	t.Helper()
	ctx := context.Background()
	tx, err := env.AppPool.Begin(ctx)
	require.NoError(t, err)
	defer func() { _ = tx.Rollback(ctx) }()

	_, err = tx.Exec(ctx, fmt.Sprintf("SET LOCAL app.current_tenant_id = '%s'", tenantID.String()))
	require.NoError(t, err)

	var count int
	err = tx.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", table)).Scan(&count)
	require.NoError(t, err)
	return count
}

// ---------- Vehicle isolation ----------

func TestRLS_TenantA_CannotSee_TenantB_Vehicles(t *testing.T) {
	env := testutil.Setup(t)

	tenantA, _ := env.CreateTenant(t, "rls-veh-a", "starter")
	tenantB, _ := env.CreateTenant(t, "rls-veh-b", "starter")

	// Insert vehicles via ownerPool (bypasses RLS)
	env.CreateVehicle(t, tenantA, "Ferrari", "F40", "Owner A")
	env.CreateVehicle(t, tenantA, "Porsche", "911", "Owner A")
	env.CreateVehicle(t, tenantB, "McLaren", "P1", "Owner B")

	// Query as tenant A via AppPool with SET LOCAL
	countA := countRows(t, env, tenantA, "vehicles")
	assert.Equal(t, 2, countA, "tenant A should see exactly 2 vehicles")

	// Query as tenant B via AppPool with SET LOCAL
	countB := countRows(t, env, tenantB, "vehicles")
	assert.Equal(t, 1, countB, "tenant B should see exactly 1 vehicle")
}

// ---------- User isolation ----------

func TestRLS_TenantA_CannotSee_TenantB_Users(t *testing.T) {
	env := testutil.Setup(t)

	tenantA, _ := env.CreateTenant(t, "rls-usr-a", "starter")
	tenantB, _ := env.CreateTenant(t, "rls-usr-b", "starter")

	env.CreateUser(t, tenantA, "alice@a.com", "P@ssw0rd!1", "admin")
	env.CreateUser(t, tenantA, "bob@a.com", "P@ssw0rd!2", "operator")
	env.CreateUser(t, tenantB, "carol@b.com", "P@ssw0rd!3", "admin")

	countA := countRows(t, env, tenantA, "users")
	assert.Equal(t, 2, countA, "tenant A should see exactly 2 users")

	countB := countRows(t, env, tenantB, "users")
	assert.Equal(t, 1, countB, "tenant B should see exactly 1 user")
}

// ---------- Event isolation ----------

func TestRLS_TenantA_CannotSee_TenantB_Events(t *testing.T) {
	env := testutil.Setup(t)

	tenantA, _ := env.CreateTenant(t, "rls-evt-a", "starter")
	tenantB, _ := env.CreateTenant(t, "rls-evt-b", "starter")

	userA := env.CreateUser(t, tenantA, "ev-user@a.com", "P@ssw0rd!1", "operator")
	vehicleA := env.CreateVehicle(t, tenantA, "Ferrari", "488", "Owner A")

	userB := env.CreateUser(t, tenantB, "ev-user@b.com", "P@ssw0rd!2", "operator")
	vehicleB := env.CreateVehicle(t, tenantB, "Lamborghini", "Huracan", "Owner B")

	// Insert events via ownerPool (bypasses RLS and the no-update/no-delete rules)
	ctx := context.Background()
	_, err := env.OwnerPool.Exec(ctx,
		`INSERT INTO events (tenant_id, vehicle_id, user_id, event_type, notes)
		 VALUES ($1, $2, $3, 'note_added', 'Event A1'),
		        ($1, $2, $3, 'note_added', 'Event A2')`,
		tenantA, vehicleA, userA,
	)
	require.NoError(t, err, "insert events for tenant A")

	_, err = env.OwnerPool.Exec(ctx,
		`INSERT INTO events (tenant_id, vehicle_id, user_id, event_type, notes)
		 VALUES ($1, $2, $3, 'note_added', 'Event B1')`,
		tenantB, vehicleB, userB,
	)
	require.NoError(t, err, "insert events for tenant B")

	countA := countRows(t, env, tenantA, "events")
	assert.Equal(t, 2, countA, "tenant A should see exactly 2 events")

	countB := countRows(t, env, tenantB, "events")
	assert.Equal(t, 1, countB, "tenant B should see exactly 1 event")
}

// ---------- Task isolation ----------

func TestRLS_TenantA_CannotSee_TenantB_Tasks(t *testing.T) {
	env := testutil.Setup(t)

	tenantA, _ := env.CreateTenant(t, "rls-tsk-a", "starter")
	tenantB, _ := env.CreateTenant(t, "rls-tsk-b", "starter")

	vehicleA := env.CreateVehicle(t, tenantA, "Porsche", "918", "Owner A")
	vehicleB := env.CreateVehicle(t, tenantB, "Bugatti", "Chiron", "Owner B")

	ctx := context.Background()
	_, err := env.OwnerPool.Exec(ctx,
		`INSERT INTO tasks (tenant_id, vehicle_id, task_type, title)
		 VALUES ($1, $2, 'battery_start', 'Start battery A1'),
		        ($1, $2, 'tire_pressure', 'Check tires A2')`,
		tenantA, vehicleA,
	)
	require.NoError(t, err, "insert tasks for tenant A")

	_, err = env.OwnerPool.Exec(ctx,
		`INSERT INTO tasks (tenant_id, vehicle_id, task_type, title)
		 VALUES ($1, $2, 'wash', 'Wash B1')`,
		tenantB, vehicleB,
	)
	require.NoError(t, err, "insert tasks for tenant B")

	countA := countRows(t, env, tenantA, "tasks")
	assert.Equal(t, 2, countA, "tenant A should see exactly 2 tasks")

	countB := countRows(t, env, tenantB, "tasks")
	assert.Equal(t, 1, countB, "tenant B should see exactly 1 task")
}

// ---------- Bay isolation ----------

func TestRLS_TenantA_CannotSee_TenantB_Bays(t *testing.T) {
	env := testutil.Setup(t)

	tenantA, _ := env.CreateTenant(t, "rls-bay-a", "starter")
	tenantB, _ := env.CreateTenant(t, "rls-bay-b", "starter")

	env.CreateBay(t, tenantA, "A-01")
	env.CreateBay(t, tenantA, "A-02")
	env.CreateBay(t, tenantA, "A-03")
	env.CreateBay(t, tenantB, "B-01")

	countA := countRows(t, env, tenantA, "bays")
	assert.Equal(t, 3, countA, "tenant A should see exactly 3 bays")

	countB := countRows(t, env, tenantB, "bays")
	assert.Equal(t, 1, countB, "tenant B should see exactly 1 bay")
}

// ---------- Cross-tenant vehicle by ID ----------

func TestRLS_CrossTenant_VehicleByID_Returns_Zero(t *testing.T) {
	env := testutil.Setup(t)

	tenantA, _ := env.CreateTenant(t, "rls-xid-a", "starter")
	tenantB, _ := env.CreateTenant(t, "rls-xid-b", "starter")

	// Vehicle belongs to tenant B
	vehicleBID := env.CreateVehicle(t, tenantB, "Rolls-Royce", "Phantom", "Owner B")

	// Query as tenant A — should not find tenant B's vehicle
	ctx := context.Background()
	tx, err := env.AppPool.Begin(ctx)
	require.NoError(t, err)
	defer func() { _ = tx.Rollback(ctx) }()

	_, err = tx.Exec(ctx, fmt.Sprintf("SET LOCAL app.current_tenant_id = '%s'", tenantA.String()))
	require.NoError(t, err)

	var count int
	err = tx.QueryRow(ctx,
		"SELECT COUNT(*) FROM vehicles WHERE id = $1", vehicleBID,
	).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 0, count, "tenant A must not see tenant B's vehicle by ID")
}

// ---------- No SET LOCAL returns nothing ----------

func TestRLS_AppRole_Without_SetLocal_Returns_Nothing(t *testing.T) {
	env := testutil.Setup(t)

	tenantA, _ := env.CreateTenant(t, "rls-noset-a", "starter")

	// Seed data via ownerPool
	env.CreateVehicle(t, tenantA, "Aston Martin", "DB11", "Owner A")
	env.CreateUser(t, tenantA, "noset@a.com", "P@ssw0rd!1", "operator")
	env.CreateBay(t, tenantA, "NS-01")

	// The RLS policy casts current_setting('app.current_tenant_id', true) to UUID.
	// When the setting is unset the cast of an empty string to UUID may error,
	// which is equally safe (query cannot return data). We accept either outcome:
	//   - 0 rows returned (safe)
	//   - an error from the UUID cast (safe — data is inaccessible)
	// Each table uses its own transaction because a failed query in PostgreSQL
	// aborts the transaction, making subsequent queries fail.
	ctx := context.Background()

	tables := []string{"vehicles", "users", "bays"}
	for _, table := range tables {
		tx, err := env.AppPool.Begin(ctx)
		require.NoError(t, err)

		var count int
		err = tx.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", table)).Scan(&count)
		if err != nil {
			// An error means the RLS policy blocked the query (UUID cast failure).
			// This is safe — the heritage_app role cannot read data without SET LOCAL.
			t.Logf("%s: query errored as expected without SET LOCAL: %v", table, err)
			_ = tx.Rollback(ctx)
			continue
		}
		assert.Equal(t, 0, count, "%s should return 0 rows when app.current_tenant_id is not set", table)
		_ = tx.Rollback(ctx)
	}
}
