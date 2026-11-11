package httpapi

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestAuthUserIncludesFarmerIdentity(t *testing.T) {
	code := " FMR-001 "
	phone := "08123456789"
	addr := "Jl. Raya Garut"
	village := "Bayongbong"
	user := authUser("usr-1", "farmer@example.com", "Farmer", "FARMER", time.Now(), &code, &phone, &addr, &village)
	if user["farmerId"] != "FMR-001" {
		t.Fatalf("expected farmerId FMR-001, got %v", user["farmerId"])
	}
	profile, ok := user["farmerProfile"].(map[string]any)
	if !ok || profile["code"] != "FMR-001" {
		t.Fatalf("expected farmerProfile code FMR-001, got %v", user["farmerProfile"])
	}
	if profile["phone"] != "08123456789" || profile["village"] != "Bayongbong" {
		t.Fatalf("expected phone and village in farmerProfile, got %v", profile)
	}
}

func TestAuthenticatedUserIDReadsBearerToken(t *testing.T) {
	server := &server{jwtSecret: []byte("test-secret")}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":  "usr-1",
		"exp": time.Now().Add(time.Minute).Unix(),
	}).SignedString(server.jwtSecret)
	if err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest("GET", "/api/v1/auth/me", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	id, err := server.authenticatedUserID(request)
	if err != nil {
		t.Fatal(err)
	}
	if id != "usr-1" {
		t.Fatalf("expected usr-1, got %s", id)
	}
}
