package httpapi

import (
	"bytes"
	"math"
	"net/http/httptest"
	"testing"
)

func TestReceptionWeightValidation(t *testing.T) {
	for _, weight := range []float64{0, -1, math.NaN(), math.Inf(1), math.Inf(-1)} {
		if validReceptionWeight(weight) {
			t.Fatalf("accepted invalid weight %v", weight)
		}
	}
	for _, weight := range []float64{0.001, 0.5, 12, 150} {
		if !validReceptionWeight(weight) {
			t.Fatalf("rejected scale weight %v", weight)
		}
	}
}

func TestReceptionReceiptValidation(t *testing.T) {
	total, err := receptionReceiptTotal("receipt", []receiptItem{{Code: "WRG-1", WeightKg: 0.1}, {Code: "WRG-2", WeightKg: 0.2}})
	if err != nil || total != 0.3 {
		t.Fatalf("expected 0.3 kg, got %v, %v", total, err)
	}
	for _, items := range [][]receiptItem{
		{{Code: "", WeightKg: 1}},
		{{Code: "WRG-1", WeightKg: -1}},
		{{Code: "WRG-1", WeightKg: math.NaN()}},
		{{Code: "WRG-1", WeightKg: 1}, {Code: "WRG-1", WeightKg: 2}},
		make([]receiptItem, 501),
	} {
		if _, err := receptionReceiptTotal("receipt", items); err == nil {
			t.Fatal("invalid receipt accepted")
		}
	}
	if _, err := receptionReceiptTotal("waring", []receiptItem{{Code: "WRG-1", WeightKg: 1}}); err == nil {
		t.Fatal("only receipts support item lists")
	}
}

func TestReceptionRejectsMalformedRequestIdentity(t *testing.T) {
	s := &server{}
	req := httptest.NewRequest("POST", "/api/v1/weighing", bytes.NewBufferString(`{"farmerCode":"FMR-001","grossWeightKg":12,"requestId":"invalid"}`))
	rec := httptest.NewRecorder()
	s.weighing(rec, req, nil)
	if rec.Code != 400 {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}
