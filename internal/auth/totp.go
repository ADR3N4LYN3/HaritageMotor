package auth

import (
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

func GenerateTOTPSecret(email string) (*otp.Key, error) {
	return totp.Generate(totp.GenerateOpts{
		Issuer:      "Heritage Motor",
		AccountName: email,
	})
}

func ValidateTOTPCode(secret, code string) bool {
	return totp.Validate(code, secret)
}
