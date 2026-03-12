package domain

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// ValidatePasswordStrength
// ---------------------------------------------------------------------------

func TestValidatePasswordStrength_Valid(t *testing.T) {
	tests := []string{
		"Abcdef1!",
		"MyP@ssw0rd",
		"C0mpl3x!Pass",
		"He!!o123World",
	}
	for _, pw := range tests {
		t.Run(pw, func(t *testing.T) {
			assert.NoError(t, ValidatePasswordStrength(pw))
		})
	}
}

func TestValidatePasswordStrength_TooShort(t *testing.T) {
	err := ValidatePasswordStrength("Ab1!xyz")
	require.Error(t, err)

	var ve *ErrValidation
	require.True(t, errors.As(err, &ve))
	assert.Equal(t, "password", ve.Field)
	assert.Contains(t, ve.Message, "8 characters")
}

func TestValidatePasswordStrength_NoUppercase(t *testing.T) {
	err := ValidatePasswordStrength("abcdef1!")
	require.Error(t, err)

	var ve *ErrValidation
	require.True(t, errors.As(err, &ve))
	assert.Contains(t, ve.Message, "uppercase")
}

func TestValidatePasswordStrength_NoLowercase(t *testing.T) {
	err := ValidatePasswordStrength("ABCDEF1!")
	require.Error(t, err)

	var ve *ErrValidation
	require.True(t, errors.As(err, &ve))
	assert.Contains(t, ve.Message, "lowercase")
}

func TestValidatePasswordStrength_NoDigit(t *testing.T) {
	err := ValidatePasswordStrength("Abcdefg!")
	require.Error(t, err)

	var ve *ErrValidation
	require.True(t, errors.As(err, &ve))
	assert.Contains(t, ve.Message, "digit")
}

func TestValidatePasswordStrength_NoSpecialChar(t *testing.T) {
	err := ValidatePasswordStrength("Abcdefg1")
	require.Error(t, err)

	var ve *ErrValidation
	require.True(t, errors.As(err, &ve))
	assert.Contains(t, ve.Message, "special")
}

func TestValidatePasswordStrength_Empty(t *testing.T) {
	err := ValidatePasswordStrength("")
	require.Error(t, err)

	var ve *ErrValidation
	require.True(t, errors.As(err, &ve))
	assert.Contains(t, ve.Message, "8 characters")
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

func TestErrNotFound_Error(t *testing.T) {
	id := uuid.New()
	err := &ErrNotFound{Resource: "vehicle", ID: id}
	assert.Contains(t, err.Error(), "vehicle")
	assert.Contains(t, err.Error(), id.String())
	assert.Contains(t, err.Error(), "not found")
}

func TestErrNotFound_AsError(t *testing.T) {
	var target *ErrNotFound
	err := error(&ErrNotFound{Resource: "bay", ID: uuid.New()})
	assert.True(t, errors.As(err, &target))
	assert.Equal(t, "bay", target.Resource)
}

func TestErrForbidden_Error(t *testing.T) {
	err := &ErrForbidden{Action: "delete vehicle"}
	assert.Contains(t, err.Error(), "forbidden")
	assert.Contains(t, err.Error(), "delete vehicle")
}

func TestErrValidation_Error(t *testing.T) {
	err := &ErrValidation{Field: "email", Message: "invalid format"}
	assert.Contains(t, err.Error(), "email")
	assert.Contains(t, err.Error(), "invalid format")
	assert.Contains(t, err.Error(), "validation error")
}

func TestErrConflict_Error(t *testing.T) {
	err := &ErrConflict{Message: "email already exists"}
	assert.Contains(t, err.Error(), "conflict")
	assert.Contains(t, err.Error(), "email already exists")
}

func TestErrUnauthorized_Error(t *testing.T) {
	err := &ErrUnauthorized{Message: "invalid credentials"}
	assert.Contains(t, err.Error(), "unauthorized")
	assert.Contains(t, err.Error(), "invalid credentials")
}

func TestErrPlanLimitReached_Error(t *testing.T) {
	err := &ErrPlanLimitReached{Resource: "vehicles", Limit: 10}
	assert.Contains(t, err.Error(), "plan limit reached")
	assert.Contains(t, err.Error(), "10")
	assert.Contains(t, err.Error(), "vehicles")
}

func TestErrTenantSuspended_Error(t *testing.T) {
	err := &ErrTenantSuspended{}
	assert.Equal(t, "tenant suspended", err.Error())
}

func TestErrors_ImplementErrorInterface(t *testing.T) {
	// Verify all error types satisfy the error interface
	var _ error = &ErrNotFound{}
	var _ error = &ErrForbidden{}
	var _ error = &ErrValidation{}
	var _ error = &ErrConflict{}
	var _ error = &ErrUnauthorized{}
	var _ error = &ErrPlanLimitReached{}
	var _ error = &ErrTenantSuspended{}
}
