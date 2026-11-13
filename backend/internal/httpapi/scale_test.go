package httpapi

import (
	"encoding/binary"
	"math"
	"testing"
)

func TestScaleRegisterWindowUsesConfiguredAddresses(t *testing.T) {
	v := scale{UnitID: 7, WeightRegister: 40003, StatusRegister: 40011}
	start, quantity, err := scaleRegisterWindow(v)
	if err != nil {
		t.Fatal(err)
	}
	if start != 2 || quantity != 9 {
		t.Fatalf("expected offset 2 and quantity 9, got offset %d and quantity %d", start, quantity)
	}

	request := buildScaleReadRequest(v, start, quantity)
	if request[6] != 7 {
		t.Fatalf("expected configured unit ID 7, got %d", request[6])
	}
	if got := int(binary.BigEndian.Uint16(request[8:10])); got != start {
		t.Fatalf("expected request start %d, got %d", start, got)
	}
	if got := int(binary.BigEndian.Uint16(request[10:12])); got != quantity {
		t.Fatalf("expected request quantity %d, got %d", quantity, got)
	}
}

func TestDecodeScaleRegistersUsesConfiguredWeightAndStatus(t *testing.T) {
	v := scale{WeightRegister: 40003, StatusRegister: 40011}
	start, quantity, err := scaleRegisterWindow(v)
	if err != nil {
		t.Fatal(err)
	}
	body := make([]byte, 2+quantity*2)
	body[0] = 3
	body[1] = byte(quantity * 2)
	weightBits := math.Float32bits(12345.5)
	binary.BigEndian.PutUint16(body[2:4], uint16(weightBits>>16))
	binary.BigEndian.PutUint16(body[4:6], uint16(weightBits))
	statusIndex := 2 + (v.StatusRegister-firstScaleRegister-start)*2
	binary.BigEndian.PutUint16(body[statusIndex:statusIndex+2], 0x0010)

	weight, status, err := decodeScaleRegisters(body, v, start, quantity)
	if err != nil {
		t.Fatal(err)
	}
	if weight != 12345.5 {
		t.Fatalf("expected configured weight 12345.5 g, got %f", weight)
	}
	if status != 0x0010 {
		t.Fatalf("expected configured status 0x0010, got 0x%04x", status)
	}
}

func TestScaleRegisterWindowRejectsIncompleteFloat(t *testing.T) {
	_, _, err := scaleRegisterWindow(scale{WeightRegister: 40031, StatusRegister: 40011})
	if err == nil {
		t.Fatal("expected register 40031 to be rejected as a FLOAT32 start address")
	}
}
