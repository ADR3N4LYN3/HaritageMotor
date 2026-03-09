package domain

import (
	"fmt"

	"github.com/google/uuid"
)

type ErrNotFound struct {
	Resource string
	ID       uuid.UUID
}

func (e *ErrNotFound) Error() string {
	return fmt.Sprintf("%s %s not found", e.Resource, e.ID)
}

type ErrForbidden struct {
	Action string
}

func (e *ErrForbidden) Error() string {
	return fmt.Sprintf("forbidden: %s", e.Action)
}

type ErrValidation struct {
	Field   string
	Message string
}

func (e *ErrValidation) Error() string {
	return fmt.Sprintf("validation error on %s: %s", e.Field, e.Message)
}

type ErrConflict struct {
	Message string
}

func (e *ErrConflict) Error() string {
	return fmt.Sprintf("conflict: %s", e.Message)
}

type ErrUnauthorized struct {
	Message string
}

func (e *ErrUnauthorized) Error() string {
	return fmt.Sprintf("unauthorized: %s", e.Message)
}

// ErrPlanLimitReached is returned when a tenant exceeds their plan limits (HTTP 402).
type ErrPlanLimitReached struct {
	Resource string
	Limit    int
}

func (e *ErrPlanLimitReached) Error() string {
	return fmt.Sprintf("plan limit reached: max %d %s", e.Limit, e.Resource)
}

// ErrTenantSuspended is returned when a tenant is suspended (HTTP 403).
type ErrTenantSuspended struct{}

func (e *ErrTenantSuspended) Error() string {
	return "tenant suspended"
}
