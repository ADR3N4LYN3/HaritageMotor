package task_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/chriis/heritage-motor/internal/testutil"
)

// listTasksResponse mirrors the paginated JSON envelope returned by GET /tasks.
type listTasksResponse struct {
	Data       []taskItem `json:"data"`
	TotalCount int        `json:"total_count"`
	Page       int        `json:"page"`
	PerPage    int        `json:"per_page"`
}

type taskItem struct {
	ID        uuid.UUID `json:"id"`
	VehicleID uuid.UUID `json:"vehicle_id"`
	TaskType  string    `json:"task_type"`
	Title     string    `json:"title"`
	Status    string    `json:"status"`
}

// createTaskResponse is used for POST /tasks → 201.
type createTaskResponse struct {
	ID        uuid.UUID `json:"id"`
	VehicleID uuid.UUID `json:"vehicle_id"`
	TaskType  string    `json:"task_type"`
	Title     string    `json:"title"`
	Status    string    `json:"status"`
}

func TestListTasks_FilterByVehicle(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-task-list", "starter")
	userID := env.CreateUser(t, tenantID, "tech-task-list@test.com", "Password1!", "technician")
	token := env.AuthToken(t, userID, tenantID, "technician")

	vehicleA := env.CreateVehicle(t, tenantID, "Ferrari", "F40", "Owner A")
	vehicleB := env.CreateVehicle(t, tenantID, "Porsche", "911", "Owner B")

	// Create a task for vehicle A
	bodyA := map[string]interface{}{
		"vehicle_id": vehicleA.String(),
		"task_type":  "battery_start",
		"title":      "Start battery A",
	}
	resp := env.DoRequest(t, http.MethodPost, "/tasks", token, bodyA)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	// Create a task for vehicle B
	bodyB := map[string]interface{}{
		"vehicle_id": vehicleB.String(),
		"task_type":  "tire_pressure",
		"title":      "Check tires B",
	}
	resp = env.DoRequest(t, http.MethodPost, "/tasks", token, bodyB)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	// Filter by vehicle A — should return only 1 task
	resp = env.DoRequest(t, http.MethodGet, "/tasks?vehicle_id="+vehicleA.String(), token, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var list listTasksResponse
	testutil.ReadJSON(t, resp, &list)
	assert.Equal(t, 1, list.TotalCount)
	assert.Len(t, list.Data, 1)
	assert.Equal(t, vehicleA, list.Data[0].VehicleID)
	assert.Equal(t, "Start battery A", list.Data[0].Title)
}

func TestCreateTask_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-task-create", "starter")
	userID := env.CreateUser(t, tenantID, "tech-task-create@test.com", "Password1!", "technician")
	token := env.AuthToken(t, userID, tenantID, "technician")

	vehicleID := env.CreateVehicle(t, tenantID, "Ferrari", "F40", "Owner Test")

	body := map[string]interface{}{
		"vehicle_id": vehicleID.String(),
		"task_type":  "battery_start",
		"title":      "Start battery",
	}

	resp := env.DoRequest(t, http.MethodPost, "/tasks", token, body)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var created createTaskResponse
	testutil.ReadJSON(t, resp, &created)
	assert.NotEqual(t, uuid.Nil, created.ID)
	assert.Equal(t, vehicleID, created.VehicleID)
	assert.Equal(t, "battery_start", created.TaskType)
	assert.Equal(t, "Start battery", created.Title)
	assert.Equal(t, "pending", created.Status)
}

func TestCompleteTask_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-task-complete", "starter")
	userID := env.CreateUser(t, tenantID, "tech-task-complete@test.com", "Password1!", "technician")
	token := env.AuthToken(t, userID, tenantID, "technician")

	vehicleID := env.CreateVehicle(t, tenantID, "Porsche", "911", "Owner Complete")

	// Create the task
	createBody := map[string]interface{}{
		"vehicle_id": vehicleID.String(),
		"task_type":  "battery_start",
		"title":      "Start battery",
	}
	resp := env.DoRequest(t, http.MethodPost, "/tasks", token, createBody)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var created createTaskResponse
	testutil.ReadJSON(t, resp, &created)

	// Complete the task
	resp = env.DoRequest(t, http.MethodPost, "/tasks/"+created.ID.String()+"/complete", token, map[string]interface{}{})
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var completeResp map[string]interface{}
	testutil.ReadJSON(t, resp, &completeResp)
	assert.Equal(t, "completed", completeResp["status"])
}

func TestCompleteTask_ViewerForbidden(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-task-viewer", "starter")

	// Create a technician to make the task
	techID := env.CreateUser(t, tenantID, "tech-task-viewer@test.com", "Password1!", "technician")
	techToken := env.AuthToken(t, techID, tenantID, "technician")

	// Create a viewer
	viewerID := env.CreateUser(t, tenantID, "viewer-task@test.com", "Password1!", "viewer")
	viewerToken := env.AuthToken(t, viewerID, tenantID, "viewer")

	vehicleID := env.CreateVehicle(t, tenantID, "McLaren", "F1", "Owner Viewer")

	// Tech creates the task
	createBody := map[string]interface{}{
		"vehicle_id": vehicleID.String(),
		"task_type":  "wash",
		"title":      "Wash car",
	}
	resp := env.DoRequest(t, http.MethodPost, "/tasks", techToken, createBody)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var created createTaskResponse
	testutil.ReadJSON(t, resp, &created)

	// Viewer tries to complete → 403
	resp = env.DoRequest(t, http.MethodPost, "/tasks/"+created.ID.String()+"/complete", viewerToken, map[string]interface{}{})
	defer resp.Body.Close()
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestDeleteTask_AdminOnly(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-task-delete", "starter")

	adminID := env.CreateUser(t, tenantID, "admin-task-del@test.com", "Password1!", "admin")
	adminToken := env.AuthToken(t, adminID, tenantID, "admin")

	operatorID := env.CreateUser(t, tenantID, "op-task-del@test.com", "Password1!", "operator")
	operatorToken := env.AuthToken(t, operatorID, tenantID, "operator")

	vehicleID := env.CreateVehicle(t, tenantID, "Bugatti", "Chiron", "Owner Del")

	// Admin creates the task (admin >= technician, can create)
	createBody := map[string]interface{}{
		"vehicle_id": vehicleID.String(),
		"task_type":  "fluid_check",
		"title":      "Check fluids",
	}
	resp := env.DoRequest(t, http.MethodPost, "/tasks", adminToken, createBody)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var created createTaskResponse
	testutil.ReadJSON(t, resp, &created)

	// Operator tries to delete → 403 (DELETE /tasks/:id requires admin)
	resp = env.DoRequest(t, http.MethodDelete, "/tasks/"+created.ID.String(), operatorToken, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)

	// Admin deletes → 204 (soft delete)
	resp = env.DoRequest(t, http.MethodDelete, "/tasks/"+created.ID.String(), adminToken, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)

	// Verify the task is no longer accessible
	resp = env.DoRequest(t, http.MethodGet, "/tasks/"+created.ID.String(), adminToken, nil)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}
