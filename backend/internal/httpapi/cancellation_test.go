package httpapi

import (
	"bytes"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestAdminCancellationRBAC(t *testing.T) {
	s := &server{jwtSecret: []byte("test-secret-key-for-admin-tests")}

	// 1. Missing Authorization header -> 401
	req1 := httptest.NewRequest("POST", "/api/v1/admin/transactions/cancel", bytes.NewBufferString(`{"waringCode":"WRG-001"}`))
	rec1 := httptest.NewRecorder()
	s.adminHandler(rec1, req1, []string{"transactions", "cancel"})
	if rec1.Code != 401 {
		t.Fatalf("expected 401 for missing auth header, got %d", rec1.Code)
	}

	// 2. Non-admin role (OPERATOR) -> 403
	opToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":   "op-1",
		"role": "OPERATOR",
		"exp":  time.Now().Add(time.Hour).Unix(),
	}).SignedString(s.jwtSecret)
	if err != nil {
		t.Fatal(err)
	}

	req2 := httptest.NewRequest("POST", "/api/v1/admin/transactions/cancel", bytes.NewBufferString(`{"waringCode":"WRG-001"}`))
	req2.Header.Set("Authorization", "Bearer "+opToken)
	rec2 := httptest.NewRecorder()
	s.adminHandler(rec2, req2, []string{"transactions", "cancel"})
	if rec2.Code != 403 {
		t.Fatalf("expected 403 for operator role, got %d", rec2.Code)
	}

	// 3. Admin role with empty waring target -> 400
	admToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":   "adm-1",
		"role": "ADMIN",
		"exp":  time.Now().Add(time.Hour).Unix(),
	}).SignedString(s.jwtSecret)
	if err != nil {
		t.Fatal(err)
	}

	req3 := httptest.NewRequest("POST", "/api/v1/admin/transactions/cancel", bytes.NewBufferString(`{}`))
	req3.Header.Set("Authorization", "Bearer "+admToken)
	rec3 := httptest.NewRecorder()
	s.adminHandler(rec3, req3, []string{"transactions", "cancel"})
	if rec3.Code != 400 {
		t.Fatalf("expected 400 for empty target, got %d", rec3.Code)
	}

	// 4. Weighing DELETE requires ADMIN role
	req4 := httptest.NewRequest("DELETE", "/api/v1/weighing/WRG-001", nil)
	req4.Header.Set("Authorization", "Bearer "+opToken)
	rec4 := httptest.NewRecorder()
	s.weighing(rec4, req4, []string{"WRG-001"})
	if rec4.Code != 403 {
		t.Fatalf("expected 403 for operator deleting waring, got %d", rec4.Code)
	}
}
