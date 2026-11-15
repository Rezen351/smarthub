package httpapi

import (
	"math"
	"strconv"
	"strings"
)

// Human-readable weights use decimal commas without thousands separators.
func formatWeightDisplay(value float64, decimals int) string {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		value = 0
	}
	formatted := strconv.FormatFloat(value, 'f', decimals, 64)
	if strings.Trim(formatted, "-0.") == "" {
		formatted = strings.TrimPrefix(formatted, "-")
	}
	return strings.Replace(formatted, ".", ",", 1)
}

func formatWeightKg(value float64) string { return formatWeightDisplay(value, 3) }
