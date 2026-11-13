package httpapi

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func (s *server) deliveriesHandler(w http.ResponseWriter, r *http.Request, path []string) {
	switch {
	case r.Method == http.MethodGet && len(path) == 0:
		s.listDeliveries(w, r)
	case r.Method == http.MethodPost && len(path) == 0:
		s.createDelivery(w, r)
	case r.Method == http.MethodPost && len(path) == 2 && path[1] == "verify":
		s.verifyDeliveryUnit(w, r, path[0])
	case r.Method == http.MethodPost && len(path) == 2 && path[1] == "depart":
		s.departDelivery(w, r, path[0])
	default:
		fail(w, http.StatusNotFound, "NOT_FOUND", "Delivery route not found")
	}
}

func (s *server) listDeliveries(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `
		SELECT d.id, d.code, d."truckPlate", d.destination, d."driverName", d.status, d."createdAt",
		       COUNT(pu.id)::int, COUNT(pu."verifiedAt")::int,
		       COALESCE(array_agg(pu.code ORDER BY pu."createdAt", pu.id) FILTER (WHERE pu.id IS NOT NULL), ARRAY[]::TEXT[])
		FROM deliveries d LEFT JOIN package_units pu ON pu."deliveryId" = d.id
		GROUP BY d.id ORDER BY d."createdAt" DESC`)
	if err != nil {
		slog.Error("list deliveries failed", "error", err)
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to list deliveries")
		return
	}
	defer rows.Close()
	out := make([]any, 0)
	for rows.Next() {
		var id, code, plate, destination, driver, status string
		var createdAt time.Time
		var units, verified int
		var packageCodes []string
		if err := rows.Scan(&id, &code, &plate, &destination, &driver, &status, &createdAt, &units, &verified, &packageCodes); err != nil {
			slog.Error("scan delivery failed", "error", err)
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to list deliveries")
			return
		}
		out = append(out, map[string]any{"id": id, "code": code, "truckPlate": plate, "destination": destination, "driverName": driver, "status": status, "units": units, "verifiedUnits": verified, "packageCodes": packageCodes, "createdAt": createdAt})
	}
	if err := rows.Err(); err != nil {
		slog.Error("iterate deliveries failed", "error", err)
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to list deliveries")
		return
	}
	write(w, map[string]any{"success": true, "data": out})
}

func (s *server) createDelivery(w http.ResponseWriter, r *http.Request) {
	var input struct {
		TruckPlate  string `json:"truckPlate"`
		Destination string `json:"destination"`
		DriverName  string `json:"driverName"`
		Grade       string `json:"grade"`
		Units       int    `json:"units"`
	}
	if !decode(r, &input) || strings.TrimSpace(input.TruckPlate) == "" || strings.TrimSpace(input.Destination) == "" || input.Units < 1 || input.Units > 10000 || (input.Grade != "A" && input.Grade != "B" && input.Grade != "C") {
		fail(w, 400, "VALIDATION_ERROR", "Truck plate, destination, grade, and a valid unit count are required")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to start delivery")
		return
	}
	defer tx.Rollback(r.Context())
	rows, err := tx.Query(r.Context(), `SELECT id FROM package_units WHERE status='STORED' AND "deliveryId" IS NULL AND grade=$1 ORDER BY "createdAt", id LIMIT $2 FOR UPDATE`, input.Grade, input.Units)
	if err != nil {
		slog.Error("select delivery units failed", "error", err)
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to select packaged units")
		return
	}
	ids := make([]string, 0, input.Units)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to select packaged units")
			return
		}
		ids = append(ids, id)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to select packaged units")
		return
	}
	if len(ids) != input.Units {
		fail(w, 400, "INSUFFICIENT_STOCK", "Not enough stored packages are available for this grade")
		return
	}
	var id string
	code := fmt.Sprintf("DLV-%s-%d", time.Now().Format("20060102"), time.Now().UnixNano())
	err = tx.QueryRow(r.Context(), `INSERT INTO deliveries (id, code, "truckPlate", destination, "driverName", status, "createdAt") VALUES (gen_random_uuid(),$1,$2,$3,$4,'LOADING',NOW()) RETURNING id`, code, strings.ToUpper(strings.TrimSpace(input.TruckPlate)), strings.TrimSpace(input.Destination), strings.TrimSpace(input.DriverName)).Scan(&id)
	if err != nil {
		slog.Error("create delivery failed", "error", err)
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to create delivery")
		return
	}
	for _, unitID := range ids {
		if _, err := tx.Exec(r.Context(), `UPDATE package_units SET "deliveryId"=$1 WHERE id=$2`, id, unitID); err != nil {
			slog.Error("assign delivery unit failed", "error", err)
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to assign delivery units")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to create delivery")
		return
	}
	writeStatus(w, 201, map[string]any{"success": true, "data": map[string]any{"id": id, "code": code, "units": len(ids), "status": "LOADING"}})
}

func (s *server) verifyDeliveryUnit(w http.ResponseWriter, r *http.Request, deliveryID string) {
	var input struct {
		Code string `json:"code"`
	}
	if !decode(r, &input) || strings.TrimSpace(input.Code) == "" {
		fail(w, 400, "VALIDATION_ERROR", "A package code or barcode is required")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to verify package")
		return
	}
	defer tx.Rollback(r.Context())
	var status string
	if err := tx.QueryRow(r.Context(), `SELECT status FROM deliveries WHERE id=$1 FOR UPDATE`, deliveryID).Scan(&status); err != nil {
		fail(w, 404, "DELIVERY_NOT_FOUND", "Delivery not found")
		return
	}
	if status == "DEPARTED" {
		fail(w, 409, "DELIVERY_DEPARTED", "Delivery has already departed")
		return
	}
	var code string
	var alreadyVerified bool
	err = tx.QueryRow(r.Context(), `SELECT code, "verifiedAt" IS NOT NULL FROM package_units WHERE "deliveryId"=$1 AND (UPPER(code)=UPPER($2) OR UPPER(barcode)=UPPER($2)) FOR UPDATE`, deliveryID, strings.TrimSpace(input.Code)).Scan(&code, &alreadyVerified)
	if err == pgx.ErrNoRows {
		fail(w, 404, "PACKAGE_NOT_IN_DELIVERY", "Package is not assigned to this delivery")
		return
	}
	if err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to verify package")
		return
	}
	if !alreadyVerified {
		if _, err := tx.Exec(r.Context(), `UPDATE package_units SET "verifiedAt"=NOW() WHERE "deliveryId"=$1 AND code=$2`, deliveryID, code); err != nil {
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to verify package")
			return
		}
	}
	var remaining int
	if err := tx.QueryRow(r.Context(), `SELECT COUNT(*) FROM package_units WHERE "deliveryId"=$1 AND "verifiedAt" IS NULL`, deliveryID).Scan(&remaining); err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to verify package")
		return
	}
	if remaining == 0 {
		if _, err := tx.Exec(r.Context(), `UPDATE deliveries SET status='READY' WHERE id=$1`, deliveryID); err != nil {
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to verify package")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to verify package")
		return
	}
	write(w, map[string]any{"success": true, "data": map[string]any{"code": code, "remainingUnits": remaining, "status": map[bool]string{true: "READY", false: "LOADING"}[remaining == 0]}})
}

func (s *server) departDelivery(w http.ResponseWriter, r *http.Request, deliveryID string) {
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to record departure")
		return
	}
	defer tx.Rollback(r.Context())
	var status string
	if err := tx.QueryRow(r.Context(), `SELECT status FROM deliveries WHERE id=$1 FOR UPDATE`, deliveryID).Scan(&status); err != nil {
		fail(w, 404, "DELIVERY_NOT_FOUND", "Delivery not found")
		return
	}
	if status != "READY" {
		fail(w, 409, "DELIVERY_NOT_READY", "Verify every assigned package before departure")
		return
	}
	if _, err := tx.Exec(r.Context(), `UPDATE package_units SET status='DISPATCHED' WHERE "deliveryId"=$1 AND "verifiedAt" IS NOT NULL AND status='STORED'`, deliveryID); err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to dispatch packages")
		return
	}
	if _, err := tx.Exec(r.Context(), `UPDATE deliveries SET status='DEPARTED', "departedAt"=NOW() WHERE id=$1`, deliveryID); err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to record departure")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to record departure")
		return
	}
	write(w, map[string]any{"success": true, "data": map[string]any{"id": deliveryID, "status": "DEPARTED"}})
}
