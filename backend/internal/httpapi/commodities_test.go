package httpapi

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidateGTIN13(t *testing.T) {
	valid := []string{
		"8994477090010", // 001 Washed Potatoes
		"8994477091017", // 101 Fresh Red Tomatoes TW
		"8994477092014", // 201 Fresh Curly Red Chili Peppers
		"8994477092021", // 202 Fresh Red Bird's Eye Chili Peppers
	}
	for _, gtin := range valid {
		if err := validateGTIN13(gtin); err != nil {
			t.Fatalf("expected GTIN-13 %s to be valid, got error: %v", gtin, err)
		}
	}

	invalid := []string{
		"",
		"899447709001",   // 12 digits
		"89944770900100", // 14 digits
		"8994477090011",  // wrong check digit
		"8994477092029",  // wrong check digit
		"899447709001X",  // non-numeric
	}
	for _, gtin := range invalid {
		if err := validateGTIN13(gtin); err == nil {
			t.Fatalf("expected GTIN-13 %q to fail validation", gtin)
		}
	}
}

func TestFormatGS1Standards(t *testing.T) {
	barcode := formatGS1PackageBarcode("8994477092021", "PCH-20261125-0001")
	wantBarcode := "010899447709202121PCH-20261125-0001"
	if barcode != wantBarcode {
		t.Fatalf("barcode = %q, want %q", barcode, wantBarcode)
	}

	// Invalid GTIN falls back safely to default potato GTIN
	fallback := formatGS1PackageBarcode("bad-gtin", "EXP-20261125-0002")
	wantFallback := "010899447709001021EXP-20261125-0002"
	if fallback != wantFallback {
		t.Fatalf("fallback barcode = %q, want %q", fallback, wantFallback)
	}

	link := formatGS1DigitalLink("8994477091017", "PLT-001-A", "PCH-20261125-0001")
	wantLink := "https://trace.smartgeulis.id/01/08994477091017/10/PLT-001-A/21/PCH-20261125-0001"
	if link != wantLink {
		t.Fatalf("digital link = %q, want %q", link, wantLink)
	}
}

func TestEncodePrintJobsCommodityVisibility(t *testing.T) {
	jobs := []printJob{
		{
			Type:       "receipt",
			Code:       "WRG-001",
			FarmerName: "Ada",
			FarmerID:   "FMR-001",
			Commodity:  "Eptilu Fresh Red Tomatoes TW 10 kg",
			WeightKg:   15.0,
		},
		{
			Type:       "waring",
			Code:       "WRG-001",
			FarmerName: "Ada",
			FarmerID:   "FMR-001",
			Commodity:  "Eptilu Fresh Red Tomatoes TW 10 kg",
			WeightKg:   15.0,
		},
		{
			Type:      "pouch",
			Code:      "PCH-20261125-0001",
			Commodity: "Eptilu Fresh Red Tomatoes TW 10 kg",
			GTIN:      "8994477091017",
			Grade:     "A",
			WeightKg:  1.0,
			Barcode:   "010899447709101721PCH-20261125-0001",
			QRValue:   "https://trace.smartgeulis.id/01/08994477091017/10/PLT-001-A/21/PCH-20261125-0001",
		},
	}

	receiptBytes, err := encodePrintJobs([]printJob{jobs[0]})
	if err != nil {
		t.Fatalf("encode receipt failed: %v", err)
	}
	if !bytes.Contains(receiptBytes, []byte("Commodity: Eptilu Fresh Red Tomatoes TW 10 kg")) {
		t.Fatalf("receipt must include dynamic commodity name")
	}

	waringBytes, err := encodePrintJobs([]printJob{jobs[1]})
	if err != nil {
		t.Fatalf("encode waring failed: %v", err)
	}
	if bytes.Contains(waringBytes, []byte("Commodity:")) {
		t.Fatalf("waring label must NOT print commodity line")
	}

	pouchBytes, err := encodePrintJobs([]printJob{jobs[2]})
	if err != nil {
		t.Fatalf("encode pouch failed: %v", err)
	}
	for _, needle := range []string{
		"Commodity: Eptilu Fresh Red Tomatoes TW 10 kg",
		"GTIN: 8994477091017",
		"Grade: A",
		"010899447709101721PCH-20261125-0001",
	} {
		if !bytes.Contains(pouchBytes, []byte(needle)) {
			t.Fatalf("packaging label missing %q", needle)
		}
	}
}

func TestCommoditiesWriteRequiresAdmin(t *testing.T) {
	s := &server{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/commodities", strings.NewReader(`{"code":"301","name":"Test","gtin":"8994477090010"}`))
	rec := httptest.NewRecorder()
	s.commoditiesHandler(rec, req, nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", rec.Code)
	}
}

