package httpapi

import (
	"context"
	"encoding/json"
	"math"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestFarmerReceptionSummary(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL is required for PostgreSQL integration tests")
	}
	ctx := context.Background()
	config, err := pgxpool.ParseConfig(cleanDatabaseURL(url))
	if err != nil {
		t.Fatal(err)
	}
	// One connection keeps all fixtures in session-local temporary tables.
	config.MaxConns = 1
	config.MinConns = 0
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	_, err = pool.Exec(ctx, `
		CREATE TEMP TABLE farmers (id text, code text, name text, village text, "createdAt" timestamp DEFAULT NOW());
		CREATE TEMP TABLE commodities (id text, code text, name text, unit text);
		CREATE TEMP TABLE warings (id text, "farmerId" text, "commodityId" text, "netWeightKg" double precision, status text);
		INSERT INTO farmers (id, code, name) VALUES
		  ('farmer-a', 'FMR-A', 'Farmer A'), ('farmer-b', 'FMR-B', 'Farmer B'), ('farmer-empty', 'FMR-EMPTY', 'Empty');
		INSERT INTO commodities VALUES ('potato', '001', 'Potato', 'kg'), ('carrot', '002', 'Carrot', 'kg');
		INSERT INTO warings VALUES
		  ('a1', 'farmer-a', 'potato', 10.1, 'PENDING'),
		  ('a2', 'farmer-a', 'potato', 20.2, 'APPROVED'),
		  ('a3', 'farmer-a', 'carrot', 30.3, 'SORTED'),
		  ('b1', 'farmer-b', 'potato', 999, 'PENDING');
	`)
	if err != nil {
		t.Fatal(err)
	}
	s := &server{db: pool}
	getSummary := func(t *testing.T, identifier string, expected float64, commodityCount int) farmerReceptionSummary {
		t.Helper()
		rec := httptest.NewRecorder()
		s.handle(rec, httptest.NewRequest("GET", "/api/v1/farmers/"+identifier+"/summary", nil))
		if rec.Code != 200 {
			t.Fatalf("summary %s: status %d: %s", identifier, rec.Code, rec.Body.String())
		}
		var payload struct {
			Success bool                   `json:"success"`
			Data    farmerReceptionSummary `json:"data"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if !payload.Success || math.Abs(payload.Data.TotalDeposited-expected) > 0.000001 || len(payload.Data.Commodities) != commodityCount {
			t.Fatalf("unexpected summary: %s", rec.Body.String())
		}
		if payload.Data.Commodities == nil {
			t.Fatal("commodities must be an array, including for empty intake")
		}
		if rec.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("reception totals must not be cached")
		}
		return payload.Data
	}

	t.Run("counts all saved statuses by commodity and farmer", func(t *testing.T) {
		summary := getSummary(t, "FMR-A", 60.6, 2)
		if summary.FarmerID != "FMR-A" || summary.FarmerName != "Farmer A" || summary.Commodities[0].TotalKg != 30.3 || summary.Commodities[1].TotalKg != 30.3 {
			t.Fatalf("unexpected commodity totals: %+v", summary)
		}
		getSummary(t, "farmer-a", 60.6, 2)
		getSummary(t, "fmr-a", 60.6, 2)
		getSummary(t, "FMR-B", 999, 1)
	})
	t.Run("empty intake and unknown farmer are distinct", func(t *testing.T) {
		getSummary(t, "FMR-EMPTY", 0, 0)
		rec := httptest.NewRecorder()
		s.handle(rec, httptest.NewRequest("GET", "/api/v1/farmers/missing/summary", nil))
		var payload response
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if rec.Code != 404 || payload.Success || payload.Error == nil || payload.Error.Code != "FARMER_NOT_FOUND" {
			t.Fatalf("unexpected missing farmer response: %s", rec.Body.String())
		}
	})
	t.Run("new intake appears before sorting and cancellation removes it", func(t *testing.T) {
		if _, err := pool.Exec(ctx, `INSERT INTO warings VALUES ('new', 'farmer-a', 'potato', 3.4, 'PENDING')`); err != nil {
			t.Fatal(err)
		}
		getSummary(t, "FMR-A", 64, 2)
		if _, err := pool.Exec(ctx, `UPDATE warings SET status='SORTED' WHERE id='new'`); err != nil {
			t.Fatal(err)
		}
		getSummary(t, "FMR-A", 64, 2)
		if _, err := pool.Exec(ctx, `DELETE FROM warings WHERE id='new'`); err != nil {
			t.Fatal(err)
		}
		getSummary(t, "FMR-A", 60.6, 2)
	})
	t.Run("farmer profile endpoint is unchanged", func(t *testing.T) {
		rec := httptest.NewRecorder()
		s.handle(rec, httptest.NewRequest("GET", "/api/v1/farmers/FMR-A", nil))
		var payload struct {
			Success bool              `json:"success"`
			Data    map[string]string `json:"data"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if rec.Code != 200 || !payload.Success || payload.Data["code"] != "FMR-A" {
			t.Fatalf("unexpected farmer profile: %s", rec.Body.String())
		}
	})
}

func TestFarmerSummaryRejectsNonGET(t *testing.T) {
	s := &server{}
	rec := httptest.NewRecorder()
	s.handle(rec, httptest.NewRequest("POST", "/api/v1/farmers/FMR-A/summary", nil))
	if rec.Code != 405 {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}
