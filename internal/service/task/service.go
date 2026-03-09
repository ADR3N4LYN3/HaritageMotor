package task

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/chriis/heritage-motor/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

type TaskFilters struct {
	Status     string     `query:"status"`
	VehicleID  *uuid.UUID `query:"vehicle_id"`
	AssignedTo *uuid.UUID `query:"assigned_to"`
	Page       int        `query:"page"`
	PerPage    int        `query:"per_page"`
}

type CreateTaskRequest struct {
	VehicleID      uuid.UUID  `json:"vehicle_id" validate:"required"`
	AssignedTo     *uuid.UUID `json:"assigned_to,omitempty"`
	TaskType       string     `json:"task_type" validate:"required"`
	Title          string     `json:"title" validate:"required,min=1,max=255"`
	Description    *string    `json:"description,omitempty"`
	DueDate        *time.Time `json:"due_date,omitempty"`
	RecurrenceDays *int       `json:"recurrence_days,omitempty"`
}

type UpdateTaskRequest struct {
	AssignedTo     *uuid.UUID `json:"assigned_to,omitempty"`
	TaskType       *string    `json:"task_type,omitempty"`
	Title          *string    `json:"title,omitempty"`
	Description    *string    `json:"description,omitempty"`
	Status         *string    `json:"status,omitempty"`
	DueDate        *time.Time `json:"due_date,omitempty"`
	RecurrenceDays *int       `json:"recurrence_days,omitempty"`
}

var taskColumns = `id, tenant_id, vehicle_id, assigned_to, task_type, title, description,
	status, due_date, completed_at, completed_by, recurrence_days, next_due_date,
	created_at, updated_at, deleted_at`

func scanTask(row pgx.Row) (*domain.Task, error) {
	var t domain.Task
	err := row.Scan(&t.ID, &t.TenantID, &t.VehicleID, &t.AssignedTo, &t.TaskType,
		&t.Title, &t.Description, &t.Status, &t.DueDate, &t.CompletedAt, &t.CompletedBy,
		&t.RecurrenceDays, &t.NextDueDate, &t.CreatedAt, &t.UpdatedAt, &t.DeletedAt)
	return &t, err
}

func scanTasks(rows pgx.Rows) ([]domain.Task, error) {
	tasks := make([]domain.Task, 0)
	for rows.Next() {
		var t domain.Task
		if err := rows.Scan(&t.ID, &t.TenantID, &t.VehicleID, &t.AssignedTo, &t.TaskType,
			&t.Title, &t.Description, &t.Status, &t.DueDate, &t.CompletedAt, &t.CompletedBy,
			&t.RecurrenceDays, &t.NextDueDate, &t.CreatedAt, &t.UpdatedAt, &t.DeletedAt); err != nil {
			return nil, fmt.Errorf("scanning task: %w", err)
		}
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tasks: %w", err)
	}
	return tasks, nil
}

func (s *Service) List(ctx context.Context, tenantID uuid.UUID, filters TaskFilters) ([]domain.Task, int, error) {
	// Normalize pagination as safety net
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.PerPage < 1 || filters.PerPage > 100 {
		filters.PerPage = 20
	}

	where := []string{"tenant_id = @tenantID", "deleted_at IS NULL"}
	args := pgx.NamedArgs{"tenantID": tenantID}

	if filters.Status != "" {
		where = append(where, "status = @status")
		args["status"] = filters.Status
	}
	if filters.VehicleID != nil {
		where = append(where, "vehicle_id = @vehicleID")
		args["vehicleID"] = *filters.VehicleID
	}
	if filters.AssignedTo != nil {
		where = append(where, "assigned_to = @assignedTo")
		args["assignedTo"] = *filters.AssignedTo
	}

	whereClause := strings.Join(where, " AND ")
	offset := (filters.Page - 1) * filters.PerPage
	args["limit"] = filters.PerPage
	args["offset"] = offset

	// Single query with COUNT(*) OVER() to avoid a separate count query.
	query := fmt.Sprintf(
		`SELECT %s, COUNT(*) OVER() AS total_count
		 FROM tasks WHERE %s
		 ORDER BY created_at DESC
		 LIMIT @limit OFFSET @offset`, taskColumns, whereClause)

	rows, err := s.pool.Query(ctx, query, args)
	if err != nil {
		log.Error().Err(err).Msg("failed to list tasks")
		return nil, 0, fmt.Errorf("listing tasks: %w", err)
	}
	defer rows.Close()

	var total int
	tasks := make([]domain.Task, 0)
	for rows.Next() {
		var t domain.Task
		if err := rows.Scan(&t.ID, &t.TenantID, &t.VehicleID, &t.AssignedTo, &t.TaskType,
			&t.Title, &t.Description, &t.Status, &t.DueDate, &t.CompletedAt, &t.CompletedBy,
			&t.RecurrenceDays, &t.NextDueDate, &t.CreatedAt, &t.UpdatedAt, &t.DeletedAt,
			&total); err != nil {
			log.Error().Err(err).Msg("failed to scan task")
			return nil, 0, fmt.Errorf("scanning task: %w", err)
		}
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		log.Error().Err(err).Msg("failed to iterate tasks")
		return nil, 0, fmt.Errorf("iterating tasks: %w", err)
	}

	return tasks, total, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, taskID uuid.UUID) (*domain.Task, error) {
	query := fmt.Sprintf(`SELECT %s FROM tasks WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, taskColumns)
	t, err := scanTask(s.pool.QueryRow(ctx, query, taskID, tenantID))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrNotFound{Resource: "task", ID: taskID}
		}
		log.Error().Err(err).Str("task_id", taskID.String()).Msg("failed to get task")
		return nil, fmt.Errorf("getting task: %w", err)
	}
	return t, nil
}

func (s *Service) Create(ctx context.Context, tenantID uuid.UUID, req CreateTaskRequest) (*domain.Task, error) {
	// Validate task type
	switch req.TaskType {
	case domain.TaskTypeBatteryStart, domain.TaskTypeTirePressure, domain.TaskTypeWash,
		domain.TaskTypeFluidCheck, domain.TaskTypeCustom:
		// valid
	default:
		return nil, &domain.ErrValidation{Field: "task_type", Message: fmt.Sprintf("invalid task type: %s", req.TaskType)}
	}

	// Calculate next_due_date if recurrence is set
	var nextDueDate *time.Time
	if req.RecurrenceDays != nil && req.DueDate != nil {
		nd := req.DueDate.AddDate(0, 0, *req.RecurrenceDays)
		nextDueDate = &nd
	}

	query := fmt.Sprintf(`INSERT INTO tasks (tenant_id, vehicle_id, assigned_to, task_type, title, description,
		status, due_date, recurrence_days, next_due_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING %s`, taskColumns)

	t, err := scanTask(s.pool.QueryRow(ctx, query,
		tenantID, req.VehicleID, req.AssignedTo, req.TaskType, req.Title, req.Description,
		domain.TaskStatusPending, req.DueDate, req.RecurrenceDays, nextDueDate))
	if err != nil {
		log.Error().Err(err).Msg("failed to create task")
		return nil, fmt.Errorf("creating task: %w", err)
	}

	log.Info().Str("task_id", t.ID.String()).Str("title", t.Title).Msg("task created")
	return t, nil
}

func (s *Service) Update(ctx context.Context, tenantID, taskID uuid.UUID, req UpdateTaskRequest) (*domain.Task, error) {
	existing, err := s.GetByID(ctx, tenantID, taskID)
	if err != nil {
		return nil, err
	}

	// Validate status if provided
	if req.Status != nil {
		switch *req.Status {
		case domain.TaskStatusPending, domain.TaskStatusCompleted, domain.TaskStatusOverdue, domain.TaskStatusCancelled:
			// valid
		default:
			return nil, &domain.ErrValidation{Field: "status", Message: fmt.Sprintf("invalid task status: %s", *req.Status)}
		}
	}

	// Validate task type if provided
	if req.TaskType != nil {
		switch *req.TaskType {
		case domain.TaskTypeBatteryStart, domain.TaskTypeTirePressure, domain.TaskTypeWash,
			domain.TaskTypeFluidCheck, domain.TaskTypeCustom:
			// valid
		default:
			return nil, &domain.ErrValidation{Field: "task_type", Message: fmt.Sprintf("invalid task type: %s", *req.TaskType)}
		}
	}

	// Apply updates
	assignedTo := existing.AssignedTo
	if req.AssignedTo != nil {
		assignedTo = req.AssignedTo
	}
	taskType := existing.TaskType
	if req.TaskType != nil {
		taskType = *req.TaskType
	}
	title := existing.Title
	if req.Title != nil {
		title = *req.Title
	}
	description := existing.Description
	if req.Description != nil {
		description = req.Description
	}
	status := existing.Status
	if req.Status != nil {
		status = *req.Status
	}
	dueDate := existing.DueDate
	if req.DueDate != nil {
		dueDate = req.DueDate
	}
	recurrenceDays := existing.RecurrenceDays
	if req.RecurrenceDays != nil {
		recurrenceDays = req.RecurrenceDays
	}

	// Recalculate next_due_date
	var nextDueDate *time.Time
	if recurrenceDays != nil && dueDate != nil {
		nd := dueDate.AddDate(0, 0, *recurrenceDays)
		nextDueDate = &nd
	}

	query := fmt.Sprintf(`UPDATE tasks SET assigned_to = $1, task_type = $2, title = $3, description = $4,
		status = $5, due_date = $6, recurrence_days = $7, next_due_date = $8, updated_at = NOW()
		WHERE id = $9 AND tenant_id = $10 AND deleted_at IS NULL
		RETURNING %s`, taskColumns)

	t, err := scanTask(s.pool.QueryRow(ctx, query,
		assignedTo, taskType, title, description, status, dueDate,
		recurrenceDays, nextDueDate, taskID, tenantID))
	if err != nil {
		log.Error().Err(err).Str("task_id", taskID.String()).Msg("failed to update task")
		return nil, fmt.Errorf("updating task: %w", err)
	}

	log.Info().Str("task_id", t.ID.String()).Msg("task updated")
	return t, nil
}

func (s *Service) Complete(ctx context.Context, tenantID, userID, taskID uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to begin transaction")
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Get the task
	query := fmt.Sprintf(`SELECT %s FROM tasks WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE`, taskColumns)
	t, err := scanTask(tx.QueryRow(ctx, query, taskID, tenantID))
	if err != nil {
		if err == pgx.ErrNoRows {
			return &domain.ErrNotFound{Resource: "task", ID: taskID}
		}
		log.Error().Err(err).Str("task_id", taskID.String()).Msg("failed to get task for completion")
		return fmt.Errorf("getting task: %w", err)
	}

	if t.Status == domain.TaskStatusCompleted {
		return &domain.ErrValidation{Field: "status", Message: "task is already completed"}
	}

	// Mark as completed
	_, err = tx.Exec(ctx,
		`UPDATE tasks SET status = $1, completed_at = NOW(), completed_by = $2, updated_at = NOW()
		 WHERE id = $3 AND tenant_id = $4`,
		domain.TaskStatusCompleted, userID, taskID, tenantID)
	if err != nil {
		log.Error().Err(err).Str("task_id", taskID.String()).Msg("failed to complete task")
		return fmt.Errorf("completing task: %w", err)
	}

	// If recurrence is set, create a new pending task
	if t.RecurrenceDays != nil && *t.RecurrenceDays > 0 {
		newDueDate := time.Now().AddDate(0, 0, *t.RecurrenceDays)
		var newNextDueDate *time.Time
		nd := newDueDate.AddDate(0, 0, *t.RecurrenceDays)
		newNextDueDate = &nd

		_, err = tx.Exec(ctx,
			`INSERT INTO tasks (tenant_id, vehicle_id, assigned_to, task_type, title, description,
				status, due_date, recurrence_days, next_due_date)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			tenantID, t.VehicleID, t.AssignedTo, t.TaskType, t.Title, t.Description,
			domain.TaskStatusPending, newDueDate, t.RecurrenceDays, newNextDueDate)
		if err != nil {
			log.Error().Err(err).Str("task_id", taskID.String()).Msg("failed to create recurring task")
			return fmt.Errorf("creating recurring task: %w", err)
		}
	}

	// Create event for task completion
	metadata := map[string]interface{}{
		"task_id":   taskID.String(),
		"task_name": t.Title,
	}
	_, err = tx.Exec(ctx,
		`INSERT INTO events (tenant_id, vehicle_id, user_id, event_type, metadata, source)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		tenantID, t.VehicleID, userID, domain.EventTypeTaskCompleted, metadata, "system")
	if err != nil {
		log.Error().Err(err).Str("task_id", taskID.String()).Msg("failed to create task completion event")
		return fmt.Errorf("creating completion event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error().Err(err).Str("task_id", taskID.String()).Msg("failed to commit task completion")
		return fmt.Errorf("committing transaction: %w", err)
	}

	log.Info().Str("task_id", taskID.String()).Str("user_id", userID.String()).Msg("task completed")
	return nil
}

func (s *Service) Delete(ctx context.Context, tenantID, taskID uuid.UUID) error {
	ct, err := s.pool.Exec(ctx,
		`UPDATE tasks SET deleted_at = NOW(), updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
		taskID, tenantID)
	if err != nil {
		log.Error().Err(err).Str("task_id", taskID.String()).Msg("failed to soft delete task")
		return fmt.Errorf("deleting task: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return &domain.ErrNotFound{Resource: "task", ID: taskID}
	}

	log.Info().Str("task_id", taskID.String()).Msg("task soft deleted")
	return nil
}
