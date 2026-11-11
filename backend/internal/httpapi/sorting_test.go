package httpapi

import (
	"bytes"
	"net/http/httptest"
	"testing"
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

