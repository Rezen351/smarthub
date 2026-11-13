package httpapi

import (
	"bytes"
	"net/http/httptest"
	"testing"
)

func TestWeighingValidationRejectsEmptyFarmerCodeOrZeroWeight(t *testing.T) {
	s := &server{}

	// Missing farmerCode
	req := httptest.NewRequest("POST", "/api/v1/weighing", bytes.NewBufferString(`{"farmerCode":"","grossWeightKg":15.5}`))
	rec := httptest.NewRecorder()
	s.weighing(rec, req, nil)

	if rec.Code != 400 {
		t.Fatalf("expected 400 for empty farmerCode, got %d", rec.Code)
	}

	// Zero grossWeightKg
	req2 := httptest.NewRequest("POST", "/api/v1/weighing", bytes.NewBufferString(`{"farmerCode":"FMR-001","grossWeightKg":0}`))
	rec2 := httptest.NewRecorder()
	s.weighing(rec2, req2, nil)

	if rec2.Code != 400 {
		t.Fatalf("expected 400 for zero weight, got %d", rec2.Code)
	}
}

