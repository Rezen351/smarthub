package httpapi

import (
	"bytes"
	"math"
	"strings"
	"testing"
)

func TestWeightDisplayUsesCommaDecimals(t *testing.T) {
	for _, tc := range []struct {
		value    float64
		expected string
	}{
		{1, "1,000"}, {1.2, "1,200"}, {12.5, "12,500"}, {1000, "1000,000"}, {1000.125, "1000,125"}, {-1.25, "-1,250"}, {math.Copysign(0, -1), "0,000"},
	} {
		if got := formatWeightKg(tc.value); got != tc.expected {
			t.Fatalf("%v: got %q, expected %q", tc.value, got, tc.expected)
		}
	}
	if got := formatWeightDisplay(12.5, 2); got != "12,50" {
		t.Fatalf("CSV display: %s", got)
	}
}

func TestPrintedWeightsDistinguishOneAndOneThousandKg(t *testing.T) {
	for _, tc := range []struct {
		value    float64
		expected string
	}{{1, "1,000 kg"}, {1000, "1000,000 kg"}} {
		payload, err := encodePrintJobs([]printJob{{Type: "waring", Code: "WRG-TEST", WeightKg: tc.value}})
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Contains(payload, []byte(tc.expected)) {
			t.Fatalf("missing weight %q", tc.expected)
		}
		if bytes.Contains(payload, []byte("1.000 kg")) {
			t.Fatal("ambiguous dot-decimal printed weight")
		}
	}
	receipt := formatReceptionReceipt([]receptionWaring{{Code: "WRG-TEST", GrossWeightKg: 1000, TareWeightKg: 1.2, NetWeightKg: 998.8}})
	for _, value := range []string{"Gross 1000,000", "Tare 1,200 kg", "Net 998,800 kg", "Total gross: 1000,000 kg", "Total net:   998,800 kg"} {
		if !strings.Contains(receipt, value) {
			t.Fatalf("receipt missing %q", value)
		}
	}
}
