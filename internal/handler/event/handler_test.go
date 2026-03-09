package event_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/chriis/heritage-motor/internal/testutil"
)

// listEventsResponse mirrors the paginated JSON envelope returned by GET /events.
type listEventsResponse struct {
	Data       []eventItem `json:"data"`
	TotalCount int         `json:"total_count"`
	Page       int         `json:"page"`
	PerPage    int         `json:"per_page"`
}

type eventItem struct {
	ID        uuid.UUID `json:"id"`
	VehicleID uuid.UUID `json:"vehicle_id"`
	EventType string    `json:"event_type"`
	Notes     *string   `json:"notes,omitempty"`
}

// createEventResponse is used for POST /events → 201.
type createEventResponse struct {
	ID        uuid.UUID `json:"id"`
	VehicleID uuid.UUID `json:"vehicle_id"`
	EventType string    `json:"event_type"`
	Notes     *string   `json:"notes,omitempty"`
	Source    string    `json:"source"`
}

func TestListEvents_FilterByVehicle(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-event-list", "starter")
	userID := env.CreateUser(t, tenantID, "tech-event-list@test.com", "Password1!", "technician")
	token := env.AuthToken(t, userID, tenantID, "technician")

	vehicleA := env.CreateVehicle(t, tenantID, "Ferrari", "F40", "Owner A")
	vehicleB := env.CreateVehicle(t, tenantID, "Porsche", "911", "Owner B")

	// Create an event for vehicle A
	bodyA := map[string]interface{}{
		"vehicle_id": vehicleA.String(),
		"event_type": "note_added",
		"notes":      "Note for A",
	}
	resp := env.DoRequest(t, http.MethodPost, "/events", token, bodyA)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	// Create an event for vehicle B
	bodyB := map[string]interface{}{
		"vehicle_id": vehicleB.String(),
		"event_type": "note_added",
		"notes":      "Note for B",
	}
	resp = env.DoRequest(t, http.MethodPost, "/events", token, bodyB)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	// Filter by vehicle A — should return only 1 event
	resp = env.DoRequest(t, http.MethodGet, "/events?vehicle_id="+vehicleA.String(), token, nil)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var list listEventsResponse
	testutil.ReadJSON(t, resp, &list)
	assert.Equal(t, 1, list.TotalCount)
	assert.Len(t, list.Data, 1)
	assert.Equal(t, vehicleA, list.Data[0].VehicleID)
}

func TestCreateEvent_Success(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-event-create", "starter")
	userID := env.CreateUser(t, tenantID, "tech-event-create@test.com", "Password1!", "technician")
	token := env.AuthToken(t, userID, tenantID, "technician")

	vehicleID := env.CreateVehicle(t, tenantID, "Ferrari", "F40", "Owner Test")

	body := map[string]interface{}{
		"vehicle_id": vehicleID.String(),
		"event_type": "note_added",
		"notes":      "Test note",
	}

	resp := env.DoRequest(t, http.MethodPost, "/events", token, body)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var created createEventResponse
	testutil.ReadJSON(t, resp, &created)
	assert.NotEqual(t, uuid.Nil, created.ID)
	assert.Equal(t, vehicleID, created.VehicleID)
	assert.Equal(t, "note_added", created.EventType)
	require.NotNil(t, created.Notes)
	assert.Equal(t, "Test note", *created.Notes)
	assert.Equal(t, "manual", created.Source)
}

func TestEvents_AppendOnly_NoUpdate(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-event-noupd", "starter")
	userID := env.CreateUser(t, tenantID, "tech-event-noupd@test.com", "Password1!", "technician")
	vehicleID := env.CreateVehicle(t, tenantID, "Ferrari", "F40", "Owner NoUpd")

	ctx := context.Background()

	// Insert an event directly via ownerPool
	eventID := uuid.New()
	originalNotes := "original note"
	_, err := env.OwnerPool.Exec(ctx,
		`INSERT INTO events (id, tenant_id, vehicle_id, user_id, event_type, notes, occurred_at, source)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		eventID, tenantID, vehicleID, userID,
		"note_added", originalNotes, time.Now().UTC(), "manual",
	)
	require.NoError(t, err)

	// Attempt to UPDATE the event — the PostgreSQL rule should silently do nothing
	_, err = env.OwnerPool.Exec(ctx,
		`UPDATE events SET notes = $1 WHERE id = $2`,
		"tampered note", eventID,
	)
	require.NoError(t, err)

	// Verify the notes are unchanged
	var notes string
	err = env.OwnerPool.QueryRow(ctx,
		`SELECT notes FROM events WHERE id = $1`, eventID,
	).Scan(&notes)
	require.NoError(t, err)
	assert.Equal(t, originalNotes, notes, "UPDATE should have been silently blocked by no_update_events rule")
}

func TestEvents_AppendOnly_NoDelete(t *testing.T) {
	env := testutil.Setup(t)

	tenantID, _ := env.CreateTenant(t, "tenant-event-nodel", "starter")
	userID := env.CreateUser(t, tenantID, "tech-event-nodel@test.com", "Password1!", "technician")
	vehicleID := env.CreateVehicle(t, tenantID, "Porsche", "911", "Owner NoDel")

	ctx := context.Background()

	// Insert an event directly via ownerPool
	eventID := uuid.New()
	_, err := env.OwnerPool.Exec(ctx,
		`INSERT INTO events (id, tenant_id, vehicle_id, user_id, event_type, notes, occurred_at, source)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		eventID, tenantID, vehicleID, userID,
		"note_added", "persistent note", time.Now().UTC(), "manual",
	)
	require.NoError(t, err)

	// Attempt to DELETE the event — the PostgreSQL rule should silently do nothing
	_, err = env.OwnerPool.Exec(ctx,
		`DELETE FROM events WHERE id = $1`, eventID,
	)
	require.NoError(t, err)

	// Verify the event still exists
	var exists bool
	err = env.OwnerPool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM events WHERE id = $1)`, eventID,
	).Scan(&exists)
	require.NoError(t, err)
	assert.True(t, exists, "DELETE should have been silently blocked by no_delete_events rule")
}
