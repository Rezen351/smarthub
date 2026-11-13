package httpapi

import (
	"bytes"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestSortingValidationRejectsEmptyWaringCode(t *testing.T) {
	s := &server{}

	req := httptest.NewRequest("POST", "/api/v1/sorting/process", bytes.NewBufferString(`{"waringCode":""}`))
	rec := httptest.NewRecorder()
	s.sortingHandler(rec, req, []string{"process"})

	if rec.Code != 400 {
		t.Fatalf("expected 400 for empty waring code, got %d", rec.Code)
	}
}

func TestPalletRouteReturnsNotFoundForInvalidSubroute(t *testing.T) {
	s := &server{}

	req := httptest.NewRequest("GET", "/api/v1/pallets/unknown/invalid/subroute", nil)
	rec := httptest.NewRecorder()
	s.pallets(rec, req, []string{"unknown", "invalid", "subroute"})

	if rec.Code != 404 {
		t.Fatalf("expected 404 for invalid pallet route, got %d", rec.Code)
	}
}

func TestSortingRejectsUnmeasuredOrUnlinkedGrades(t *testing.T) {
	cases := []struct {
		name   string
		grades []sortingGradeInput
	}{
		{"missing pallet", []sortingGradeInput{{GradeCode: "A", WeightKg: 5}}},
		{"negative weight", []sortingGradeInput{{GradeCode: "A", WeightKg: -2, PalletCode: "PLT-001"}}},
		{"reused pallet", []sortingGradeInput{{GradeCode: "A", WeightKg: 5, PalletCode: "PLT-001"}, {GradeCode: "B", WeightKg: 3, PalletCode: "plt-001"}}},
		{"repeated grade", []sortingGradeInput{{GradeCode: "A", WeightKg: 5, PalletCode: "PLT-001"}, {GradeCode: "A", WeightKg: 3, PalletCode: "PLT-002"}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := validateSortingGrades(tc.grades); err == nil {
				t.Fatal("expected invalid sorting grades to be rejected")
			}
		})
	}
	if err := validateSortingGrades([]sortingGradeInput{{GradeCode: "A", WeightKg: 5, PalletCode: "PLT-001"}}); err != nil {
		t.Fatalf("valid grade rejected: %v", err)
	}
}

func TestValidateCloseoutDisposition(t *testing.T) {
	valid := []string{"SHRINKAGE_LOSS", "cull_reject", " LOOSE_RESERVE ", "SAMPLE_USE"}
	for _, d := range valid {
		got, err := validateCloseoutDisposition(d)
		if err != nil || got == "" {
			t.Fatalf("expected valid disposition for %q, got err=%v", d, err)
		}
	}

	if _, err := validateCloseoutDisposition("INVALID_REASON"); err == nil {
		t.Fatal("expected invalid closeout disposition to fail")
	}
}

func TestPalletReleaseAuthAndRoleChecks(t *testing.T) {
	s := &server{jwtSecret: []byte("test-secret")}

	// Unauthenticated request -> 401
	reqUnauth := httptest.NewRequest("POST", "/api/v1/pallets/PLT-001/release", bytes.NewBufferString(`{"disposition":"SHRINKAGE_LOSS"}`))
	recUnauth := httptest.NewRecorder()
	s.pallets(recUnauth, reqUnauth, []string{"PLT-001", "release"})
	if recUnauth.Code != 401 {
		t.Fatalf("expected 401 without token, got %d", recUnauth.Code)
	}

	// FARMER role -> 403
	farmerToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":   "usr-farmer",
		"role": "FARMER",
		"exp":  time.Now().Add(time.Minute).Unix(),
	}).SignedString(s.jwtSecret)
	if err != nil {
		t.Fatal(err)
	}
	reqFarmer := httptest.NewRequest("POST", "/api/v1/pallets/PLT-001/release", bytes.NewBufferString(`{"disposition":"SHRINKAGE_LOSS"}`))
	reqFarmer.Header.Set("Authorization", "Bearer "+farmerToken)
	recFarmer := httptest.NewRecorder()
	s.pallets(recFarmer, reqFarmer, []string{"PLT-001", "release"})
	if recFarmer.Code != 403 {
		t.Fatalf("expected 403 for FARMER role, got %d", recFarmer.Code)
	}

	// OPERATOR role with invalid disposition -> 400
	opToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":   "usr-op",
		"role": "OPERATOR",
		"exp":  time.Now().Add(time.Minute).Unix(),
	}).SignedString(s.jwtSecret)
	if err != nil {
		t.Fatal(err)
	}
	reqBadDisp := httptest.NewRequest("POST", "/api/v1/pallets/PLT-001/release", bytes.NewBufferString(`{"disposition":"UNKNOWN"}`))
	reqBadDisp.Header.Set("Authorization", "Bearer "+opToken)
	recBadDisp := httptest.NewRecorder()
	s.pallets(recBadDisp, reqBadDisp, []string{"PLT-001", "release"})
	if recBadDisp.Code != 400 {
		t.Fatalf("expected 400 for invalid disposition, got %d", recBadDisp.Code)
	}
}
