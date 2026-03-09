package plan_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/chriis/heritage-motor/internal/domain"
	plansvc "github.com/chriis/heritage-motor/internal/service/plan"
	"github.com/chriis/heritage-motor/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------- Plan limit enforcement ----------

func TestPlanLimit_StarterVehicles_25(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "plan-limit-v", "starter")
	ctx := context.Background()

	svc := plansvc.NewService(env.OwnerPool)

	// Create 25 vehicles (starter limit)
	for i := 0; i < 25; i++ {
		env.CreateVehicle(t, tenantID, "Car", "Model", "Owner")
	}

	// 25th is at the limit — next should fail
	err := svc.CheckLimitForTenant(ctx, tenantID, "vehicles")
	require.Error(t, err)

	var planErr *domain.ErrPlanLimitReached
	assert.ErrorAs(t, err, &planErr)
	assert.Equal(t, "vehicles", planErr.Resource)
	assert.Equal(t, 25, planErr.Limit)
}

func TestPlanLimit_StarterUsers_5(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "plan-limit-u", "starter")
	ctx := context.Background()

	svc := plansvc.NewService(env.OwnerPool)

	// Create 5 users (starter limit)
	for i := 0; i < 5; i++ {
		env.CreateUser(t, tenantID, fmt.Sprintf("user%d@test.com", i), "P@ssw0rd!!", "operator")
	}

	err := svc.CheckLimitForTenant(ctx, tenantID, "users")
	require.Error(t, err)

	var planErr *domain.ErrPlanLimitReached
	assert.ErrorAs(t, err, &planErr)
	assert.Equal(t, "users", planErr.Resource)
	assert.Equal(t, 5, planErr.Limit)
}

func TestPlanLimit_StarterBays_20(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "plan-limit-b", "starter")
	ctx := context.Background()

	svc := plansvc.NewService(env.OwnerPool)

	// Create 20 bays (starter limit)
	for i := 0; i < 20; i++ {
		env.CreateBay(t, tenantID, fmt.Sprintf("BAY-%02d", i))
	}

	err := svc.CheckLimitForTenant(ctx, tenantID, "bays")
	require.Error(t, err)

	var planErr *domain.ErrPlanLimitReached
	assert.ErrorAs(t, err, &planErr)
	assert.Equal(t, "bays", planErr.Resource)
	assert.Equal(t, 20, planErr.Limit)
}

func TestPlanLimit_ProHigherLimits(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "plan-pro-limit", "pro")
	ctx := context.Background()

	svc := plansvc.NewService(env.OwnerPool)

	// Create 25 vehicles — starter limit, but pro allows 100
	for i := 0; i < 25; i++ {
		env.CreateVehicle(t, tenantID, "Car", "Model", "Owner")
	}

	// Should still be allowed (pro limit is 100)
	err := svc.CheckLimitForTenant(ctx, tenantID, "vehicles")
	assert.NoError(t, err, "pro plan should allow more than 25 vehicles")
}

func TestPlanLimit_EnterpriseUnlimited(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "plan-enterprise", "enterprise")
	ctx := context.Background()

	svc := plansvc.NewService(env.OwnerPool)

	// Create some vehicles
	for i := 0; i < 10; i++ {
		env.CreateVehicle(t, tenantID, "Car", "Model", "Owner")
	}

	// Enterprise has unlimited (-1)
	err := svc.CheckLimitForTenant(ctx, tenantID, "vehicles")
	assert.NoError(t, err, "enterprise plan should have unlimited resources")
}

func TestPlanLimit_UnderLimit_NoError(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "plan-under", "starter")
	ctx := context.Background()

	svc := plansvc.NewService(env.OwnerPool)

	// Create just 1 vehicle — well under starter limit of 25
	env.CreateVehicle(t, tenantID, "Ferrari", "F40", "Owner")

	err := svc.CheckLimitForTenant(ctx, tenantID, "vehicles")
	assert.NoError(t, err, "should not error when under the limit")
}

// ---------- Plan limit via HTTP (vehicle creation blocked) ----------

func TestPlanLimit_VehicleCreation_BlockedAtLimit(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "plan-http-block", "starter")
	userID := env.CreateUser(t, tenantID, "plan-http@test.com", "P@ssw0rd!!", "operator")
	token := env.AuthToken(t, userID, tenantID, "operator")

	// Fill up to the starter limit (25 vehicles)
	for i := 0; i < 25; i++ {
		env.CreateVehicle(t, tenantID, "Car", "Model", "Owner")
	}

	// 26th via API should be rejected
	payload := map[string]interface{}{
		"make":       "Porsche",
		"model":      "Taycan",
		"owner_name": "Over Limit Owner",
	}

	resp := env.DoRequest(t, "POST", "/vehicles", token, payload)
	assert.Equal(t, 402, resp.StatusCode, "should return 402 when plan limit is reached")
}
