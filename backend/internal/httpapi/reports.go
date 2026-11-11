package httpapi

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (s *server) reportsHandler(w http.ResponseWriter, r *http.Request, p []string) {
	if len(p) == 0 {
		fail(w, 404, "NOT_FOUND", "Route not found")
		return
	}

	switch p[0] {
	case "recap":
		if len(p) > 1 && p[1] == "daily" {
			s.dailyRecap(w, r)
			return
		}
		if len(p) > 1 && p[1] == "monthly" {
			s.monthlyRecap(w, r)
			return
		}
		fail(w, 404, "NOT_FOUND", "Recap endpoint not found")
	case "rankings":
		if len(p) > 1 && p[1] == "farmers" {
			s.farmerRankings(w, r)
			return
		}
		fail(w, 404, "NOT_FOUND", "Rankings endpoint not found")
	default:
		fail(w, 404, "NOT_FOUND", "Route not found")
	}
}

func (s *server) dailyRecap(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		fail(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}

	targetDate := strings.TrimSpace(r.URL.Query().Get("date"))
	if targetDate == "" {
		targetDate = time.Now().Format("2006-01-02")
	}

	ctx := r.Context()

	// 1. Warings intake aggregate
	var totalWarings, uniqueFarmers int
	var grossKg, tareKg, netKg float64
	_ = s.db.QueryRow(ctx, `
		SELECT COUNT(w.id), COALESCE(SUM(w."grossWeightKg"), 0), COALESCE(SUM(w."tareWeightKg"), 0), COALESCE(SUM(w."netWeightKg"), 0), COUNT(DISTINCT w."farmerId")
		FROM warings w
		WHERE DATE(w."createdAt") = $1::date
	`, targetDate).Scan(&totalWarings, &grossKg, &tareKg, &netKg)

	// 2. Sorting batches aggregate
	var sortingBatches int
	var gradeAKg, gradeBKg, gradeCKg, shrinkageKg float64
	_ = s.db.QueryRow(ctx, `
		SELECT COUNT(sb.id), COALESCE(SUM(sb."gradeA_Kg"), 0), COALESCE(SUM(sb."gradeB_Kg"), 0), COALESCE(SUM(sb."gradeC_Kg"), 0), COALESCE(SUM(sb."shrinkageKg"), 0)
		FROM sorting_batches sb
		WHERE DATE(sb."sortedAt") = $1::date
	`, targetDate).Scan(&sortingBatches, &gradeAKg, &gradeBKg, &gradeCKg, &shrinkageKg)

	// 3. Packaging aggregate
	var packagedUnits int
	var packagedWeightKg float64
	_ = s.db.QueryRow(ctx, `
		SELECT COUNT(pu.id), COALESCE(SUM(pu."weightKg"), 0)
		FROM package_units pu
		WHERE DATE(pu."createdAt") = $1::date
	`, targetDate).Scan(&packagedUnits, &packagedWeightKg)

	// 4. Per-farmer breakdown for the day
	rows, err := s.db.Query(ctx, `
		SELECT f.code, f.name, COALESCE(f.village, ''), COUNT(w.id), COALESCE(SUM(w."grossWeightKg"), 0), COALESCE(SUM(w."tareWeightKg"), 0), COALESCE(SUM(w."netWeightKg"), 0)
		FROM warings w
		JOIN farmers f ON f.id = w."farmerId"
		WHERE DATE(w."createdAt") = $1::date
		GROUP BY f.code, f.name, f.village
		ORDER BY SUM(w."grossWeightKg") DESC
	`, targetDate)

	type dailyFarmerRow struct {
		FarmerCode  string  `json:"farmerCode"`
		FarmerName  string  `json:"farmerName"`
		Village     string  `json:"village"`
		Warings     int     `json:"warings"`
		GrossWeight float64 `json:"grossWeightKg"`
		TareWeight  float64 `json:"tareWeightKg"`
		NetWeight   float64 `json:"netWeightKg"`
	}

	farmerRows := []dailyFarmerRow{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var r dailyFarmerRow
			if rows.Scan(&r.FarmerCode, &r.FarmerName, &r.Village, &r.Warings, &r.GrossWeight, &r.TareWeight, &r.NetWeight) == nil {
				farmerRows = append(farmerRows, r)
			}
		}
	}

	isCsv := r.URL.Query().Get("format") == "csv" || strings.Contains(r.Header.Get("Accept"), "text/csv")
	if isCsv {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"smartgeulis_daily_recap_%s.csv\"", targetDate))
		writer := csv.NewWriter(w)
		defer writer.Flush()

		_ = writer.Write([]string{"SmartGeulis Daily Recap Report", targetDate})
		_ = writer.Write([]string{""})
		_ = writer.Write([]string{"Summary Metric", "Value"})
		_ = writer.Write([]string{"Date", targetDate})
		_ = writer.Write([]string{"Total Warings Received", strconv.Itoa(totalWarings)})
		_ = writer.Write([]string{"Unique Delivering Farmers", strconv.Itoa(uniqueFarmers)})
		_ = writer.Write([]string{"Gross Intake (kg)", fmt.Sprintf("%.2f", grossKg)})
		_ = writer.Write([]string{"Tare Weight (kg)", fmt.Sprintf("%.2f", tareKg)})
		_ = writer.Write([]string{"Net Intake (kg)", fmt.Sprintf("%.2f", netKg)})
		_ = writer.Write([]string{"Sorting Batches", strconv.Itoa(sortingBatches)})
		_ = writer.Write([]string{"Grade A Yield (kg)", fmt.Sprintf("%.2f", gradeAKg)})
		_ = writer.Write([]string{"Grade B Yield (kg)", fmt.Sprintf("%.2f", gradeBKg)})
		_ = writer.Write([]string{"Grade C Yield (kg)", fmt.Sprintf("%.2f", gradeCKg)})
		_ = writer.Write([]string{"Sorting Shrinkage (kg)", fmt.Sprintf("%.2f", shrinkageKg)})
		_ = writer.Write([]string{"Retail Pouches Packaged", strconv.Itoa(packagedUnits)})
		_ = writer.Write([]string{"Packaged Weight (kg)", fmt.Sprintf("%.2f", packagedWeightKg)})
		_ = writer.Write([]string{""})

		_ = writer.Write([]string{"Farmer Code", "Farmer Name", "Village", "Warings", "Gross (kg)", "Tare (kg)", "Net (kg)"})
		for _, f := range farmerRows {
			_ = writer.Write([]string{
				f.FarmerCode,
				f.FarmerName,
				f.Village,
				strconv.Itoa(f.Warings),
				fmt.Sprintf("%.2f", f.GrossWeight),
				fmt.Sprintf("%.2f", f.TareWeight),
				fmt.Sprintf("%.2f", f.NetWeight),
			})
		}
		return
	}

	write(w, map[string]any{
		"success": true,
		"data": map[string]any{
			"date":             targetDate,
			"totalWarings":     totalWarings,
			"uniqueFarmers":    uniqueFarmers,
			"grossIntakeKg":    grossKg,
			"tareWeightKg":     tareKg,
			"netIntakeKg":      netKg,
			"sortingBatches":   sortingBatches,
			"gradeAKg":         gradeAKg,
			"gradeBKg":         gradeBKg,
			"gradeCKg":         gradeCKg,
			"shrinkageKg":      shrinkageKg,
			"packagedUnits":    packagedUnits,
			"packagedWeightKg": packagedWeightKg,
			"farmerBreakdown":  farmerRows,
		},
	})
}

func (s *server) monthlyRecap(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		fail(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}

	targetMonth := strings.TrimSpace(r.URL.Query().Get("month"))
	if targetMonth == "" {
		targetMonth = time.Now().Format("2006-01")
	}

	ctx := r.Context()

	// 1. Monthly overall aggregates
	var totalWarings, activeFarmers int
	var grossKg, tareKg, netKg float64
	_ = s.db.QueryRow(ctx, `
		SELECT COUNT(w.id), COALESCE(SUM(w."grossWeightKg"), 0), COALESCE(SUM(w."tareWeightKg"), 0), COALESCE(SUM(w."netWeightKg"), 0), COUNT(DISTINCT w."farmerId")
		FROM warings w
		WHERE TO_CHAR(w."createdAt", 'YYYY-MM') = $1
	`, targetMonth).Scan(&totalWarings, &grossKg, &tareKg, &netKg)

	var sortingBatches int
	var gradeAKg, gradeBKg, gradeCKg, shrinkageKg float64
	_ = s.db.QueryRow(ctx, `
		SELECT COUNT(sb.id), COALESCE(SUM(sb."gradeA_Kg"), 0), COALESCE(SUM(sb."gradeB_Kg"), 0), COALESCE(SUM(sb."gradeC_Kg"), 0), COALESCE(SUM(sb."shrinkageKg"), 0)
		FROM sorting_batches sb
		WHERE TO_CHAR(sb."sortedAt", 'YYYY-MM') = $1
	`, targetMonth).Scan(&sortingBatches, &gradeAKg, &gradeBKg, &gradeCKg, &shrinkageKg)

	var packagedUnits int
	var packagedWeightKg float64
	_ = s.db.QueryRow(ctx, `
		SELECT COUNT(pu.id), COALESCE(SUM(pu."weightKg"), 0)
		FROM package_units pu
		WHERE TO_CHAR(pu."createdAt", 'YYYY-MM') = $1
	`, targetMonth).Scan(&packagedUnits, &packagedWeightKg)

	// 2. Daily breakdown within the month
	type dailyBreakdownItem struct {
		Date        string  `json:"date"`
		Warings     int     `json:"warings"`
		GrossWeight float64 `json:"grossWeightKg"`
		NetWeight   float64 `json:"netWeightKg"`
		Farmers     int     `json:"farmers"`
	}

	dailyRows := []dailyBreakdownItem{}
	rows, err := s.db.Query(ctx, `
		SELECT TO_CHAR(w."createdAt", 'YYYY-MM-DD') AS day,
		       COUNT(w.id) AS warings,
		       COALESCE(SUM(w."grossWeightKg"), 0) AS gross_kg,
		       COALESCE(SUM(w."netWeightKg"), 0) AS net_kg,
		       COUNT(DISTINCT w."farmerId") AS farmers
		FROM warings w
		WHERE TO_CHAR(w."createdAt", 'YYYY-MM') = $1
		GROUP BY day
		ORDER BY day ASC
	`, targetMonth)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var d dailyBreakdownItem
			if rows.Scan(&d.Date, &d.Warings, &d.GrossWeight, &d.NetWeight, &d.Farmers) == nil {
				dailyRows = append(dailyRows, d)
			}
		}
	}

	// 3. Top 5 farmers this month
	type topFarmerItem struct {
		FarmerCode  string  `json:"farmerCode"`
		FarmerName  string  `json:"farmerName"`
		Village     string  `json:"village"`
		Warings     int     `json:"warings"`
		GrossWeight float64 `json:"grossWeightKg"`
		NetWeight   float64 `json:"netWeightKg"`
	}
	topFarmers := []topFarmerItem{}
	tfRows, tfErr := s.db.Query(ctx, `
		SELECT f.code, f.name, COALESCE(f.village, ''), COUNT(w.id), COALESCE(SUM(w."grossWeightKg"), 0), COALESCE(SUM(w."netWeightKg"), 0)
		FROM warings w
		JOIN farmers f ON f.id = w."farmerId"
		WHERE TO_CHAR(w."createdAt", 'YYYY-MM') = $1
		GROUP BY f.code, f.name, f.village
		ORDER BY SUM(w."grossWeightKg") DESC
		LIMIT 5
	`, targetMonth)
	if tfErr == nil {
		defer tfRows.Close()
		for tfRows.Next() {
			var tf topFarmerItem
			if tfRows.Scan(&tf.FarmerCode, &tf.FarmerName, &tf.Village, &tf.Warings, &tf.GrossWeight, &tf.NetWeight) == nil {
				topFarmers = append(topFarmers, tf)
			}
		}
	}

	isCsv := r.URL.Query().Get("format") == "csv" || strings.Contains(r.Header.Get("Accept"), "text/csv")
	if isCsv {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"smartgeulis_monthly_recap_%s.csv\"", targetMonth))
		writer := csv.NewWriter(w)
		defer writer.Flush()

		_ = writer.Write([]string{"SmartGeulis Monthly Recap Report", targetMonth})
		_ = writer.Write([]string{""})
		_ = writer.Write([]string{"Monthly Summary", "Value"})
		_ = writer.Write([]string{"Month", targetMonth})
		_ = writer.Write([]string{"Total Warings Received", strconv.Itoa(totalWarings)})
		_ = writer.Write([]string{"Active Delivering Farmers", strconv.Itoa(activeFarmers)})
		_ = writer.Write([]string{"Gross Intake (kg)", fmt.Sprintf("%.2f", grossKg)})
		_ = writer.Write([]string{"Tare Weight (kg)", fmt.Sprintf("%.2f", tareKg)})
		_ = writer.Write([]string{"Net Intake (kg)", fmt.Sprintf("%.2f", netKg)})
		_ = writer.Write([]string{"Sorting Batches", strconv.Itoa(sortingBatches)})
		_ = writer.Write([]string{"Grade A Yield (kg)", fmt.Sprintf("%.2f", gradeAKg)})
		_ = writer.Write([]string{"Grade B Yield (kg)", fmt.Sprintf("%.2f", gradeBKg)})
		_ = writer.Write([]string{"Grade C Yield (kg)", fmt.Sprintf("%.2f", gradeCKg)})
		_ = writer.Write([]string{"Sorting Shrinkage (kg)", fmt.Sprintf("%.2f", shrinkageKg)})
		_ = writer.Write([]string{"Retail Pouches Packaged", strconv.Itoa(packagedUnits)})
		_ = writer.Write([]string{"Packaged Weight (kg)", fmt.Sprintf("%.2f", packagedWeightKg)})
		_ = writer.Write([]string{""})

		_ = writer.Write([]string{"Date", "Warings", "Gross Intake (kg)", "Net Intake (kg)", "Delivering Farmers"})
		for _, d := range dailyRows {
			_ = writer.Write([]string{
				d.Date,
				strconv.Itoa(d.Warings),
				fmt.Sprintf("%.2f", d.GrossWeight),
				fmt.Sprintf("%.2f", d.NetWeight),
				strconv.Itoa(d.Farmers),
			})
		}

		_ = writer.Write([]string{""})
		_ = writer.Write([]string{"Top 5 Farmers This Month", "Code", "Village", "Warings", "Gross (kg)", "Net (kg)"})
		for _, tf := range topFarmers {
			_ = writer.Write([]string{
				tf.FarmerName,
				tf.FarmerCode,
				tf.Village,
				strconv.Itoa(tf.Warings),
				fmt.Sprintf("%.2f", tf.GrossWeight),
				fmt.Sprintf("%.2f", tf.NetWeight),
			})
		}
		return
	}

	write(w, map[string]any{
		"success": true,
		"data": map[string]any{
			"month":            targetMonth,
			"totalWarings":     totalWarings,
			"activeFarmers":    activeFarmers,
			"grossIntakeKg":    grossKg,
			"tareWeightKg":     tareKg,
			"netIntakeKg":      netKg,
			"sortingBatches":   sortingBatches,
			"gradeAKg":         gradeAKg,
			"gradeBKg":         gradeBKg,
			"gradeCKg":         gradeCKg,
			"shrinkageKg":      shrinkageKg,
			"packagedUnits":    packagedUnits,
			"packagedWeightKg": packagedWeightKg,
			"dailyBreakdown":   dailyRows,
			"topFarmers":       topFarmers,
		},
	})
}

func (s *server) farmerRankings(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		fail(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}

	limit := 10
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	period := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("period")))

	ctx := r.Context()

	// Compute overall total gross weight for percentage calculation
	var grandTotalGross float64
	dateFilter := ""
	var args []any
	if period == "today" {
		dateFilter = `WHERE DATE(w."createdAt") = CURRENT_DATE`
	} else if period == "month" {
		dateFilter = `WHERE TO_CHAR(w."createdAt", 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')`
	}

	_ = s.db.QueryRow(ctx, fmt.Sprintf(`SELECT COALESCE(SUM(w."grossWeightKg"), 0) FROM warings w %s`, dateFilter)).Scan(&grandTotalGross)

	query := fmt.Sprintf(`
		SELECT f.id, f.code, f.name, COALESCE(f.village, ''), COALESCE(f.district, ''),
		       COUNT(w.id) as total_warings,
		       COALESCE(SUM(w."grossWeightKg"), 0) as total_gross_kg,
		       COALESCE(SUM(w."netWeightKg"), 0) as total_net_kg,
		       MAX(w."createdAt") as last_intake_at
		FROM farmers f
		JOIN warings w ON w."farmerId" = f.id
		%s
		GROUP BY f.id, f.code, f.name, f.village, f.district
		ORDER BY total_gross_kg DESC
		LIMIT $1
	`, dateFilter)

	args = append(args, limit)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to retrieve farmer rankings")
		return
	}
	defer rows.Close()

	type rankingItem struct {
		Rank         int       `json:"rank"`
		FarmerID     string    `json:"farmerId"`
		FarmerCode   string    `json:"farmerCode"`
		FarmerName   string    `json:"farmerName"`
		Village      string    `json:"village"`
		District     string    `json:"district"`
		TotalWarings int       `json:"totalWarings"`
		TotalGrossKg float64   `json:"totalGrossKg"`
		TotalNetKg   float64   `json:"totalNetKg"`
		SharePct     float64   `json:"sharePct"`
		LastIntakeAt time.Time `json:"lastIntakeAt"`
	}

	rankings := []rankingItem{}
	rank := 1
	for rows.Next() {
		var id, code, name, village, district string
		var warings int
		var gross, net float64
		var lastAt time.Time
		if rows.Scan(&id, &code, &name, &village, &district, &warings, &gross, &net, &lastAt) == nil {
			share := 0.0
			if grandTotalGross > 0 {
				share = (gross / grandTotalGross) * 100
			}
			rankings = append(rankings, rankingItem{
				Rank:         rank,
				FarmerID:     id,
				FarmerCode:   code,
				FarmerName:   name,
				Village:      village,
				District:     district,
				TotalWarings: warings,
				TotalGrossKg: gross,
				TotalNetKg:   net,
				SharePct:     share,
				LastIntakeAt: lastAt,
			})
			rank++
		}
	}

	isCsv := r.URL.Query().Get("format") == "csv" || strings.Contains(r.Header.Get("Accept"), "text/csv")
	if isCsv {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=\"smartgeulis_farmer_rankings.csv\"")
		writer := csv.NewWriter(w)
		defer writer.Flush()

		_ = writer.Write([]string{"Rank", "Farmer Code", "Farmer Name", "Village", "District", "Total Warings", "Gross Weight (kg)", "Net Weight (kg)", "Share (%)", "Last Delivery"})
		for _, r := range rankings {
			_ = writer.Write([]string{
				strconv.Itoa(r.Rank),
				r.FarmerCode,
				r.FarmerName,
				r.Village,
				r.District,
				strconv.Itoa(r.TotalWarings),
				fmt.Sprintf("%.2f", r.TotalGrossKg),
				fmt.Sprintf("%.2f", r.TotalNetKg),
				fmt.Sprintf("%.1f%%", r.SharePct),
				r.LastIntakeAt.Format(time.RFC3339),
			})
		}
		return
	}

	write(w, map[string]any{
		"success": true,
		"data": map[string]any{
			"period":          period,
			"grandTotalGross": grandTotalGross,
			"rankings":        rankings,
		},
	})
}

