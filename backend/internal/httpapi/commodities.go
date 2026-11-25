package httpapi

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	defaultCommodityCode = "001"
	defaultCommodityGTIN = "8994477090010"
	defaultTraceDomain   = "https://trace.smartgeulis.id"
)

// validateGTIN13 checks that gtin is a 13-digit numeric string with a valid GS1 Modulo-10 check digit.
func validateGTIN13(gtin string) error {
	g := strings.TrimSpace(gtin)
	if len(g) != 13 {
		return fmt.Errorf("GTIN-13 must be exactly 13 digits")
	}
	sum := 0
	for i := 0; i < 12; i++ {
		if g[i] < '0' || g[i] > '9' {
			return fmt.Errorf("GTIN-13 must contain only numeric digits")
		}
		d := int(g[i] - '0')
		if i%2 == 0 {
			sum += d
		} else {
			sum += d * 3
		}
	}
	if g[12] < '0' || g[12] > '9' {
		return fmt.Errorf("GTIN-13 must contain only numeric digits")
	}
	expected := (10 - (sum % 10)) % 10
	actual := int(g[12] - '0')
	if actual != expected {
		return fmt.Errorf("Invalid GTIN-13 check digit: expected %d, got %d", expected, actual)
	}
	return nil
}

// formatGS1PackageBarcode returns an international GS1-128 AI element string:
// AI (01) GTIN-14 (leading 0 + 13-digit GTIN-13) + AI (21) unique serial package code.
func formatGS1PackageBarcode(gtin13, packageCode string) string {
	g := strings.TrimSpace(gtin13)
	if validateGTIN13(g) != nil {
		g = defaultCommodityGTIN
	}
	return fmt.Sprintf("010%s21%s", g, strings.TrimSpace(packageCode))
}

// formatGS1DigitalLink returns an international GS1 Digital Link v1.2 URI:
// https://{domain}/01/{GTIN-14}/10/{LOT}/21/{SERIAL}
func formatGS1DigitalLink(gtin13, lot, serial string) string {
	g := strings.TrimSpace(gtin13)
	if validateGTIN13(g) != nil {
		g = defaultCommodityGTIN
	}
	cleanLot := strings.TrimSpace(lot)
	if cleanLot == "" {
		cleanLot = "BATCH"
	}
	return fmt.Sprintf("%s/01/0%s/10/%s/21/%s", defaultTraceDomain, g, cleanLot, strings.TrimSpace(serial))
}

func (s *server) commoditiesHandler(w http.ResponseWriter, r *http.Request, p []string) {
	// GET /api/v1/commodities
	if r.Method == "GET" && len(p) == 0 {
		includeInactive := strings.EqualFold(r.URL.Query().Get("includeInactive"), "true")
		whereClause := `WHERE c."isActive" = true`
		if includeInactive {
			whereClause = ""
		}

		rows, err := s.db.Query(r.Context(), fmt.Sprintf(`
			SELECT c.id, c.code, c.name, COALESCE(c.description, ''), c.unit,
			       COALESCE(c.gtin, ''), COALESCE(c.brand, 'Eptilu'), COALESCE(c."packageType", 'Carton Box'),
			       c."isActive", c."createdAt"
			FROM commodities c
			%s
			ORDER BY c.code ASC
		`, whereClause))
		if err != nil {
			slog.Error("failed to list commodities", "error", err)
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to list commodities")
			return
		}
		defer rows.Close()

		type commodityItem struct {
			ID          string    `json:"id"`
			Code        string    `json:"code"`
			Name        string    `json:"name"`
			Description string    `json:"description"`
			Unit        string    `json:"unit"`
			GTIN        string    `json:"gtin"`
			Brand       string    `json:"brand"`
			PackageType string    `json:"packageType"`
			IsActive    bool      `json:"isActive"`
			CreatedAt   time.Time `json:"createdAt"`
		}

		out := []commodityItem{}
		for rows.Next() {
			var item commodityItem
			if err := rows.Scan(
				&item.ID, &item.Code, &item.Name, &item.Description, &item.Unit,
				&item.GTIN, &item.Brand, &item.PackageType, &item.IsActive, &item.CreatedAt,
			); err == nil {
				out = append(out, item)
			}
		}
		write(w, map[string]any{"success": true, "data": out})
		return
	}

	// Admin-only write routes: POST /api/v1/commodities, PUT/DELETE /api/v1/commodities/:id
	_, role, err := s.authenticatedClaims(r)
	if err != nil {
		fail(w, 401, "UNAUTHORIZED", "Valid administrator authentication is required")
		return
	}
	if role != "ADMIN" {
		fail(w, 403, "FORBIDDEN", "Only administrators can manage commodity master data")
		return
	}

	// POST /api/v1/commodities
	if r.Method == "POST" && len(p) == 0 {
		var input struct {
			Code        string `json:"code"`
			Name        string `json:"name"`
			Description string `json:"description"`
			Unit        string `json:"unit"`
			GTIN        string `json:"gtin"`
			Brand       string `json:"brand"`
			PackageType string `json:"packageType"`
			IsActive    *bool  `json:"isActive"`
		}
		if !decode(r, &input) {
			fail(w, 400, "VALIDATION_ERROR", "Invalid JSON payload")
			return
		}
		code := strings.TrimSpace(input.Code)
		name := strings.TrimSpace(input.Name)
		gtin := strings.TrimSpace(input.GTIN)
		unit := strings.TrimSpace(input.Unit)
		if unit == "" {
			unit = "kg"
		}
		brand := strings.TrimSpace(input.Brand)
		if brand == "" {
			brand = "Eptilu"
		}
		pkgType := strings.TrimSpace(input.PackageType)
		if pkgType == "" {
			pkgType = "Carton Box"
		}
		isActive := true
		if input.IsActive != nil {
			isActive = *input.IsActive
		}
		if code == "" || name == "" || gtin == "" {
			fail(w, 400, "VALIDATION_ERROR", "Product code, name, and GTIN-13 are required")
			return
		}
		if err := validateGTIN13(gtin); err != nil {
			fail(w, 400, "INVALID_GTIN", err.Error())
			return
		}

		tx, err := s.db.Begin(r.Context())
		if err != nil {
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to start database transaction")
			return
		}
		defer tx.Rollback(r.Context())

		id := "cmd-" + strings.ToLower(strings.ReplaceAll(code, " ", "-"))
		var createdAt time.Time
		err = tx.QueryRow(r.Context(), `
			INSERT INTO commodities (id, code, name, description, unit, gtin, brand, "packageType", "isActive", "createdAt")
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
			RETURNING "createdAt"
		`, id, code, name, strings.TrimSpace(input.Description), unit, gtin, brand, pkgType, isActive).Scan(&createdAt)
		if err != nil {
			if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
				fail(w, 409, "COMMODITY_ALREADY_EXISTS", "A commodity with this code, name, or GTIN-13 already exists")
				return
			}
			slog.Error("failed to create commodity", "error", err)
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to create commodity")
			return
		}

		// Auto-seed default commercial grades A, B, C for the new commodity
		for _, grd := range []struct{ name, spec, desc string }{
			{"A", "Grade A", "Premium commercial grade"},
			{"B", "Grade B", "Standard commercial grade"},
			{"C", "Grade C", "Secondary/processing grade"},
		} {
			grdID := fmt.Sprintf("grd-%s-%s", strings.ToLower(code), strings.ToLower(grd.name))
			_, _ = tx.Exec(r.Context(), `
				INSERT INTO grades (id, name, "sizeSpec", description, "commodityId", "createdAt")
				VALUES ($1, $2, $3, $4, $5, NOW())
				ON CONFLICT (name, "commodityId") DO NOTHING
			`, grdID, grd.name, grd.spec, grd.desc, id)
		}

		if err := tx.Commit(r.Context()); err != nil {
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to commit commodity creation")
			return
		}

		writeStatus(w, 201, map[string]any{
			"success": true,
			"data": map[string]any{
				"id":          id,
				"code":        code,
				"name":        name,
				"description": strings.TrimSpace(input.Description),
				"unit":        unit,
				"gtin":        gtin,
				"brand":       brand,
				"packageType": pkgType,
				"isActive":    isActive,
				"createdAt":   createdAt,
			},
		})
		return
	}

	// PUT /api/v1/commodities/:id
	if r.Method == "PUT" && len(p) == 1 {
		target := strings.TrimSpace(p[0])
		var input struct {
			Code        *string `json:"code"`
			Name        *string `json:"name"`
			Description *string `json:"description"`
			Unit        *string `json:"unit"`
			GTIN        *string `json:"gtin"`
			Brand       *string `json:"brand"`
			PackageType *string `json:"packageType"`
			IsActive    *bool   `json:"isActive"`
		}
		if !decode(r, &input) {
			fail(w, 400, "VALIDATION_ERROR", "Invalid JSON payload")
			return
		}

		var id, code, name, description, unit, gtin, brand, pkgType string
		var isActive bool
		var createdAt time.Time
		err := s.db.QueryRow(r.Context(), `
			SELECT id, code, name, COALESCE(description, ''), unit, COALESCE(gtin, ''), COALESCE(brand, 'Eptilu'), COALESCE("packageType", 'Carton Box'), "isActive", "createdAt"
			FROM commodities
			WHERE id = $1 OR code = $1
			LIMIT 1
		`, target).Scan(&id, &code, &name, &description, &unit, &gtin, &brand, &pkgType, &isActive, &createdAt)
		if err == pgx.ErrNoRows {
			fail(w, 404, "COMMODITY_NOT_FOUND", "Specified commodity could not be found")
			return
		}
		if err != nil {
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to load commodity")
			return
		}

		if input.Code != nil && strings.TrimSpace(*input.Code) != "" {
			code = strings.TrimSpace(*input.Code)
		}
		if input.Name != nil && strings.TrimSpace(*input.Name) != "" {
			name = strings.TrimSpace(*input.Name)
		}
		if input.Description != nil {
			description = strings.TrimSpace(*input.Description)
		}
		if input.Unit != nil && strings.TrimSpace(*input.Unit) != "" {
			unit = strings.TrimSpace(*input.Unit)
		}
		if input.GTIN != nil && strings.TrimSpace(*input.GTIN) != "" {
			nextGTIN := strings.TrimSpace(*input.GTIN)
			if err := validateGTIN13(nextGTIN); err != nil {
				fail(w, 400, "INVALID_GTIN", err.Error())
				return
			}
			gtin = nextGTIN
		}
		if input.Brand != nil && strings.TrimSpace(*input.Brand) != "" {
			brand = strings.TrimSpace(*input.Brand)
		}
		if input.PackageType != nil && strings.TrimSpace(*input.PackageType) != "" {
			pkgType = strings.TrimSpace(*input.PackageType)
		}
		if input.IsActive != nil {
			isActive = *input.IsActive
		}

		_, err = s.db.Exec(r.Context(), `
			UPDATE commodities
			SET code=$1, name=$2, description=$3, unit=$4, gtin=$5, brand=$6, "packageType"=$7, "isActive"=$8
			WHERE id=$9
		`, code, name, description, unit, gtin, brand, pkgType, isActive, id)
		if err != nil {
			if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
				fail(w, 409, "COMMODITY_ALREADY_EXISTS", "A commodity with this code, name, or GTIN-13 already exists")
				return
			}
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to update commodity")
			return
		}

		write(w, map[string]any{
			"success": true,
			"data": map[string]any{
				"id":          id,
				"code":        code,
				"name":        name,
				"description": description,
				"unit":        unit,
				"gtin":        gtin,
				"brand":       brand,
				"packageType": pkgType,
				"isActive":    isActive,
				"createdAt":   createdAt,
			},
		})
		return
	}

	// DELETE /api/v1/commodities/:id -> soft-deactivate if referenced, otherwise delete
	if r.Method == "DELETE" && len(p) == 1 {
		target := strings.TrimSpace(p[0])
		var id, code string
		err := s.db.QueryRow(r.Context(), `SELECT id, code FROM commodities WHERE id=$1 OR code=$1 LIMIT 1`, target).Scan(&id, &code)
		if err == pgx.ErrNoRows {
			fail(w, 404, "COMMODITY_NOT_FOUND", "Specified commodity could not be found")
			return
		}
		if err != nil {
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to look up commodity")
			return
		}

		var refCount int
		_ = s.db.QueryRow(r.Context(), `
			SELECT (SELECT COUNT(*) FROM warings WHERE "commodityId"=$1) +
			       (SELECT COUNT(*) FROM package_units WHERE "commodityId"=$1)
		`, id).Scan(&refCount)

		if refCount > 0 {
			_, err = s.db.Exec(r.Context(), `UPDATE commodities SET "isActive"=false WHERE id=$1`, id)
			if err != nil {
				fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to deactivate commodity")
				return
			}
			write(w, map[string]any{
				"success": true,
				"data": map[string]any{
					"id":          id,
					"code":        code,
					"deactivated": true,
					"message":     "Commodity has historical records and was deactivated instead of deleted",
				},
			})
			return
		}

		_, _ = s.db.Exec(r.Context(), `DELETE FROM grades WHERE "commodityId"=$1`, id)
		_, err = s.db.Exec(r.Context(), `DELETE FROM commodities WHERE id=$1`, id)
		if err != nil {
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to delete commodity")
			return
		}
		write(w, map[string]any{
			"success": true,
			"data": map[string]any{
				"id":      id,
				"code":    code,
				"deleted": true,
			},
		})
		return
	}

	fail(w, 404, "NOT_FOUND", "Commodity route not found")
}

