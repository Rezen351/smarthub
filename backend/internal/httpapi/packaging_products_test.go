package httpapi

import (
	"bytes"
	"math"
	"testing"
)

func TestProductGTINs(t *testing.T) {
	for i, gtin := range []string{"8994477090010", "8994477090011", "8994477090012", "8994477090013", "8994477090014", "8994477090015"} {
		if validGTIN13(gtin) != (i == 0) {
			t.Fatalf("unexpected validity for %s", gtin)
		}
	}
	for _, invalid := range []string{"", "899447709001", "89944770900100", "899447709001x"} {
		if validGTIN13(invalid) {
			t.Fatalf("accepted %q", invalid)
		}
		if hasGTIN13Digits(invalid) {
			t.Fatalf("accepted unusable GTIN format %q", invalid)
		}
	}
	if !hasGTIN13Digits("8994477090011") {
		t.Fatal("rejected 13-digit GTIN with a check-digit mismatch")
	}
}

func TestPackagingProductValidation(t *testing.T) {
	product := packagingProduct{ProductNumber: "001", GTIN: "8994477090010", Package: "box", NominalWeightKg: 10, WashDecision: "WASHED"}
	for _, weight := range []float64{9.95, 10, 10.05} {
		if err := validatePackagingProduct(product, "WASHED", weight, 1); err != nil {
			t.Fatal(err)
		}
	}
	for _, weight := range []float64{0, 9.949, 10.051, math.NaN(), math.Inf(1)} {
		if validatePackagingProduct(product, "WASHED", weight, 1) == nil {
			t.Fatalf("accepted %v", weight)
		}
	}
	for _, wash := range []string{"", "UNWASHED", "UNKNOWN"} {
		if validatePackagingProduct(product, wash, 10, 1) == nil {
			t.Fatalf("accepted wash %q", wash)
		}
	}
	if validatePackagingProduct(product, "WASHED", 10, 2) == nil {
		t.Fatal("accepted multiple units")
	}
	product.GTIN = "8994477090011"
	if err := validatePackagingProduct(product, "WASHED", 10, 1); err != nil {
		t.Fatalf("blocked 13-digit GTIN with a check-digit mismatch: %v", err)
	}
	product.GTIN = "8994477090010"
	for _, size := range []int{1, 5} {
		product.NominalWeightKg = size
		tolerance := .05
		if size == 1 {
			tolerance = .005
		}
		if err := validatePackagingProduct(product, "WASHED", float64(size)+tolerance, 1); err != nil {
			t.Fatal(err)
		}
		if validatePackagingProduct(product, "WASHED", float64(size)+tolerance+.001, 1) == nil {
			t.Fatal("accepted weight outside tolerance")
		}
	}
}

func TestPackagingLabelContainsTwoBarcodesWithoutQR(t *testing.T) {
	product := &packagingProduct{GTIN: "8994477090010", ProductName: "Washed potatoes 10 kg", Brand: "Eptilu Premium Potato", NominalWeightKg: 10, Package: "box", WashDecision: "WASHED"}
	for _, kind := range []string{"pouch", "export"} {
		payload, err := encodePrintJobs([]printJob{{Type: kind, Code: "EXP-20261115-0001", Product: product, Grade: "A", WeightKg: 10, Date: "2026-11-15"}})
		if err != nil {
			t.Fatal(err)
		}
		if bytes.Count(payload, []byte{0x1d, 0x6b, 0x49}) != 0 || bytes.Count(payload, []byte{0x1d, 0x6b, 0x43}) != 1 {
			t.Fatal("expected only one EAN-13 barcode")
		}
		if bytes.Contains(payload, []byte{0x1d, 0x28, 0x6b}) {
			t.Fatal("Packaging contains a QR command")
		}
		for _, value := range []string{product.GTIN, "Weight: 10,000 kg", "Grade: A", "GS1 Barcode"} {
			if !bytes.Contains(payload, []byte(value)) {
				t.Fatalf("missing %s", value)
			}
		}
		for _, omitted := range []string{"SMARTGEULIS", "PACKAGING LABEL", "Operational Barcode", "EXP-20261115-0001", product.ProductName, product.Brand, "PRINTED", "2026-11-15"} {
			if bytes.Contains(payload, []byte(omitted)) {
				t.Fatalf("Packaging label contains extra field %q", omitted)
			}
		}
	}
	if _, err := encodePrintJobs([]printJob{{Type: "export", Code: "legacy"}}); err == nil {
		t.Fatal("accepted missing product")
	}
	product.GTIN = "8994477090011"
	if _, err := encodePrintJobs([]printJob{{Type: "export", Code: "code", Product: product}}); err != nil {
		t.Fatalf("blocked 13-digit GTIN barcode: %v", err)
	}
	product.GTIN = "899447709001x"
	if _, err := encodePrintJobs([]printJob{{Type: "export", Code: "code", Product: product}}); err == nil {
		t.Fatal("accepted non-numeric GTIN")
	}
}
