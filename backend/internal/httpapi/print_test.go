package httpapi

import (
	"bytes"
	"testing"
)

func TestEncodePrintJobsMatchesPreviewLayout(t *testing.T) {
	jobs := []printJob{
		{Type: "receipt", Code: "WRG-001", FarmerName: "Ada", WeightKg: 12.5, Date: "2026-11-02"},
		{Type: "waring", Code: "WRG-001", FarmerName: "Ada", FarmerID: "FMR-001", WeightKg: 12.5, Date: "2026-11-02"},
	}
	payload, err := encodePrintJobs(jobs)
	if err != nil {
		t.Fatal(err)
	}
	qrSize := []byte{0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05}
	if got := bytes.Count(payload, qrSize); got != 1 {
		t.Fatalf("expected one normal-size QR for the waring label, got %d", got)
	}
	receipt := bytes.Index(payload, []byte("RECEIVING RECEIPT\n"))
	waring := bytes.Index(payload, []byte("WARING LABEL\n"))
	if receipt < 0 || waring <= receipt {
		t.Fatal("receipt and waring label are missing or out of order")
	}
	cutCmd := []byte{0x1d, 0x56, 0x42, 0x03}
	if got := bytes.Count(payload, cutCmd); got != 2 {
		t.Fatalf("expected two paper cut commands (one after receipt, one after waring), got %d", got)
	}
	if !bytes.Contains(payload[receipt:waring], cutCmd) {
		t.Fatal("expected paper cut command between receipt and waring label so they print separately")
	}
	if bytes.Contains(payload[receipt:waring], qrSize) || bytes.Contains(payload[receipt:waring], []byte{0x1d, 0x6b, 0x49}) {
		t.Fatal("receipt should not contain a barcode or QR")
	}
	for _, field := range [][]byte{[]byte("Farmer: Ada"), []byte("Commodity: Potatoes"), []byte("12.500 kg\n"), []byte("WRG-001\n"), []byte("BUFFER_WAITING")} {
		if !bytes.Contains(payload[receipt:waring], field) {
			t.Fatalf("receipt missing %q", field)
		}
	}
	label := payload[waring:]
	separator := []byte("--------------------------------\n")
	positions := [][]byte{
		[]byte("WARING LABEL\n"), separator,
		[]byte("Farmer: Ada\n"),
		[]byte("Farmer ID: FMR-001\n"), separator,
		[]byte("12.500 kg\n"), []byte("WRG-001\n"), separator,
		qrSize,
		[]byte{0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30},
		[]byte("2026-11-02\n"), []byte("PRINTED\n"),
	}
	last := 0
	for _, field := range positions {
		position := bytes.Index(label[last:], field)
		if position < 0 {
			t.Fatalf("label field %q is missing or out of requested order", field)
		}
		last += position + len(field)
	}
}
