package domain

import "unicode"

// ValidatePasswordStrength enforces password complexity rules:
// min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character.
func ValidatePasswordStrength(password string) error {
	if len(password) < 8 {
		return &ErrValidation{Field: "password", Message: "password must be at least 8 characters"}
	}
	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r):
			hasSpecial = true
		}
	}
	if !hasUpper {
		return &ErrValidation{Field: "password", Message: "password must contain at least one uppercase letter"}
	}
	if !hasLower {
		return &ErrValidation{Field: "password", Message: "password must contain at least one lowercase letter"}
	}
	if !hasDigit {
		return &ErrValidation{Field: "password", Message: "password must contain at least one digit"}
	}
	if !hasSpecial {
		return &ErrValidation{Field: "password", Message: "password must contain at least one special character"}
	}
	return nil
}
