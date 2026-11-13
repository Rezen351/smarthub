package httpapi

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDeliveryRejectsInvalidAllocationBeforeDatabaseAccess(t *testing.T) {
	s := &server{}
	for _, body := range []string{
		`{"truckPlate":"","destination":"Jakarta","grade":"A","units":1}`,
		`{"truckPlate":"B1234","destination":"Jakarta","grade":"A","units":0}`,
		`{"truckPlate":"B1234","destination":"Jakarta","grade":"D","units":2}`,
		`{"truckPlate":"B1234","destination":"Jakarta","grade":"A","units":10001}`,
	} {
		req := httptest.NewRequest("POST", "/api/v1/deliveries", strings.NewReader(body))
		rec := httptest.NewRecorder()
		s.deliveriesHandler(rec, req, nil)
		if rec.Code != 400 {
			t.Fatalf("expected 400 for %s, got %d", body, rec.Code)
		}
	}
}

func TestDeliveryVerificationRequiresPackageCode(t *testing.T) {
	s := &server{}
	req := httptest.NewRequest("POST", "/api/v1/deliveries/dlv-1/verify", strings.NewReader(`{"code":" "}`))
	rec := httptest.NewRecorder()
	s.deliveriesHandler(rec, req, []string{"dlv-1", "verify"})
	if rec.Code != 400 {
		t.Fatalf("expected 400 for empty package code, got %d", rec.Code)
	}
}
