package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID   uuid.UUID `json:"user_id"`
	TenantID uuid.UUID `json:"tenant_id"`
	Role     string    `json:"role"`
	jwt.RegisteredClaims
}

type MFAPendingClaims struct {
	UserID   uuid.UUID `json:"user_id"`
	TenantID uuid.UUID `json:"tenant_id"`
	Pending  bool      `json:"mfa_pending"`
	jwt.RegisteredClaims
}

type JWTManager struct {
	secret        []byte
	accessExpiry  time.Duration
	refreshExpiry time.Duration
}

func NewJWTManager(secret string, accessExpiry, refreshExpiry time.Duration) *JWTManager {
	return &JWTManager{
		secret:        []byte(secret),
		accessExpiry:  accessExpiry,
		refreshExpiry: refreshExpiry,
	}
}

func (m *JWTManager) GenerateAccessToken(userID, tenantID uuid.UUID, role string) (string, error) {
	claims := &Claims{
		UserID:   userID,
		TenantID: tenantID,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(m.accessExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "heritagemotor.app",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *JWTManager) GenerateMFAPendingToken(userID, tenantID uuid.UUID) (string, error) {
	claims := &MFAPendingClaims{
		UserID:   userID,
		TenantID: tenantID,
		Pending:  true,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "heritagemotor.app",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *JWTManager) RefreshExpiry() time.Duration {
	return m.refreshExpiry
}

func (m *JWTManager) ValidateAccessToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("parse token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}

func (m *JWTManager) ValidateMFAPendingToken(tokenString string) (*MFAPendingClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &MFAPendingClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("parse mfa token: %w", err)
	}

	claims, ok := token.Claims.(*MFAPendingClaims)
	if !ok || !token.Valid || !claims.Pending {
		return nil, fmt.Errorf("invalid mfa pending token")
	}

	return claims, nil
}
