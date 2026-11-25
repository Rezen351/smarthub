package httpapi

import (
	"fmt"
	"math"
	"strings"
)

func validReceptionWeight(weight float64) bool {
	return !math.IsNaN(weight) && !math.IsInf(weight, 0) && weight >= 0.001
}

func receptionReceiptTotal(kind string, items []receiptItem) (float64, error) {
	if kind != "receipt" || len(items) > 500 {
		return 0, fmt.Errorf("a receiving receipt supports at most 500 bags")
	}
	total := 0.0
	codes := make(map[string]bool, len(items))
	for _, item := range items {
		if strings.TrimSpace(item.Code) == "" || codes[item.Code] || !validReceptionWeight(item.WeightKg) {
			return 0, fmt.Errorf("receipt items require unique codes and positive finite weights")
		}
		codes[item.Code] = true
		total += math.Round(item.WeightKg * 1000)
	}
	if !validReceptionWeight(total / 1000) {
		return 0, fmt.Errorf("receipt total weight is invalid")
	}
	return total / 1000, nil
}
