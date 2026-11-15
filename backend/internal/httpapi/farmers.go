package httpapi

import (
	"log/slog"
	"math"
	"net/http"
)

type farmerCommodityTotal struct {
	CommodityID   string  `json:"commodityId"`
	CommodityName string  `json:"commodityName"`
	CommodityCode string  `json:"commodityCode"`
	Unit          string  `json:"unit"`
	TotalKg       float64 `json:"totalKg"`
}

type farmerReceptionSummary struct {
	FarmerID       string                 `json:"farmerId"`
	FarmerName     string                 `json:"farmerName"`
	TotalDeposited float64                `json:"totalDeposited"`
	Commodities    []farmerCommodityTotal `json:"commodities"`
}

func (s *server) farmerSummary(w http.ResponseWriter, r *http.Request, idOrCode string) {
	// Reception records remain deposits after they move through Sorting and Packaging.
	rows, err := s.db.Query(r.Context(), `
		SELECT f.code, f.name, c.id, c.name, c.code, c.unit,
		       COALESCE(SUM(w."netWeightKg"), 0)
		FROM farmers f
		LEFT JOIN warings w ON w."farmerId" = f.id
		LEFT JOIN commodities c ON c.id = w."commodityId"
		WHERE f.id = $1 OR UPPER(f.code) = UPPER($1)
		GROUP BY f.id, f.code, f.name, c.id, c.name, c.code, c.unit
		ORDER BY c.code
	`, idOrCode)
	if err != nil {
		slog.Error("failed to query farmer reception summary", "error", err)
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to load reception summary")
		return
	}
	defer rows.Close()

	summary := farmerReceptionSummary{Commodities: []farmerCommodityTotal{}}
	found := false
	for rows.Next() {
		var commodityID, commodityName, commodityCode, unit *string
		var totalKg float64
		if err := rows.Scan(&summary.FarmerID, &summary.FarmerName, &commodityID, &commodityName, &commodityCode, &unit, &totalKg); err != nil {
			slog.Error("failed to scan farmer reception summary", "error", err)
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to load reception summary")
			return
		}
		found = true
		if commodityID != nil {
			totalKg = math.Round(totalKg*1000) / 1000
			summary.Commodities = append(summary.Commodities, farmerCommodityTotal{
				CommodityID: *commodityID, CommodityName: *commodityName,
				CommodityCode: *commodityCode, Unit: *unit, TotalKg: totalKg,
			})
			summary.TotalDeposited += totalKg
		}
	}
	if err := rows.Err(); err != nil {
		slog.Error("failed to read farmer reception summary", "error", err)
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to load reception summary")
		return
	}
	if !found {
		fail(w, 404, "FARMER_NOT_FOUND", "Farmer not found")
		return
	}
	summary.TotalDeposited = math.Round(summary.TotalDeposited*1000) / 1000
	w.Header().Set("Cache-Control", "no-store")
	write(w, response{Success: true, Data: summary})
}
