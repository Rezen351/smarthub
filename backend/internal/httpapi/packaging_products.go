package httpapi

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"time"
)

type packagingProduct struct {
	ProductNumber   string `json:"productNumber"`
	GTIN            string `json:"gtin"`
	Brand           string `json:"brand"`
	ProductName     string `json:"productName"`
	Package         string `json:"package"`
	NominalWeightKg int    `json:"nominalWeightKg"`
	WashDecision    string `json:"washDecision"`
	GTINValid       bool   `json:"gtinValid"`
}

func validGTIN13(value string) bool {
	if len(value) != 13 {
		return false
	}
	sum := 0
	for i, c := range value {
		if c < '0' || c > '9' {
			return false
		}
		factor := 1
		if i%2 == 1 {
			factor = 3
		}
		sum += int(c-'0') * factor
	}
	return sum%10 == 0
}

func validatePackagingProduct(product packagingProduct, wash string, weight float64, quantity int) error {
	if quantity != 1 {
		return fmt.Errorf("Package quantity must be one")
	}
	if !validGTIN13(product.GTIN) {
		return fmt.Errorf("Product %s has an invalid GTIN. Confirm the official GTIN before packaging", product.ProductNumber)
	}
	if wash != "WASHED" && wash != "UNWASHED" {
		return fmt.Errorf("The source Sorting batch has no washing status")
	}
	if product.WashDecision != wash {
		return fmt.Errorf("Product washing status does not match the source Sorting batch")
	}
	if product.Package != "box" || (product.NominalWeightKg != 1 && product.NominalWeightKg != 5 && product.NominalWeightKg != 10) {
		return fmt.Errorf("Unsupported Packaging product")
	}
	tolerance := 0.05
	if product.NominalWeightKg == 1 {
		tolerance = 0.005
	}
	if math.IsNaN(weight) || math.IsInf(weight, 0) || math.Abs(weight-float64(product.NominalWeightKg)) > tolerance+1e-9 {
		return fmt.Errorf("Package weight is outside the product tolerance")
	}
	return nil
}

func (s *server) packagingProducts(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `SELECT "productNumber", gtin, brand, "productName", package, "nominalWeightKg", "washDecision" FROM packaging_products ORDER BY "productNumber"`)
	if err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to list Packaging products")
		return
	}
	defer rows.Close()
	products := []packagingProduct{}
	for rows.Next() {
		var p packagingProduct
		if err := rows.Scan(&p.ProductNumber, &p.GTIN, &p.Brand, &p.ProductName, &p.Package, &p.NominalWeightKg, &p.WashDecision); err != nil {
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to read Packaging product")
			return
		}
		p.GTINValid = validGTIN13(p.GTIN)
		products = append(products, p)
	}
	if rows.Err() != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to read Packaging products")
		return
	}
	write(w, response{Success: true, Data: products})
}

// Package labels use persisted data only, including after the source pallet is reused.
func (s *server) packagePrintJob(ctx context.Context, code string) (printJob, error) {
	var job printJob
	var created time.Time
	var snapshot *packagingProduct
	err := s.db.QueryRow(ctx, `SELECT code, grade, "weightKg", "createdAt", "productSnapshot" FROM package_units WHERE code=$1`, code).Scan(&job.Code, &job.Grade, &job.WeightKg, &created, &snapshot)
	if err != nil {
		return job, fmt.Errorf("Load package label: %w", err)
	}
	if snapshot == nil || !validGTIN13(snapshot.GTIN) {
		return job, fmt.Errorf("Package has no valid product snapshot and cannot print a GS1 label")
	}
	job.Type = "export"
	job.Product = snapshot
	job.Date = created.Format("2006-01-02")
	job.Time = created.Format("15:04:05")
	return job, nil
}

func (s *server) authorizePackaging(w http.ResponseWriter, r *http.Request) bool {
	_, role, err := s.authenticatedClaims(r)
	if err != nil {
		fail(w, 401, "UNAUTHORIZED", "A valid operator authentication token is required")
		return false
	}
	if role != "ADMIN" && role != "OPERATOR" && role != "PACKAGING_OPERATOR" {
		fail(w, 403, "FORBIDDEN", "Only operators and administrators can manage Packaging")
		return false
	}
	return true
}
