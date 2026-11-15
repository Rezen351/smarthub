package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

const receptionTareKg = 1.2

var receptionIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,80}$`)

type receptionCapture struct {
	CaptureID     string    `json:"captureId"`
	GrossWeightKg float64   `json:"grossWeightKg"`
	CapturedAt    time.Time `json:"capturedAt"`
}
type receptionRequest struct {
	ID         string             `json:"id"`
	FarmerCode string             `json:"farmerCode"`
	Items      []receptionCapture `json:"items"`
}
type receptionWaring struct {
	ID            string    `json:"id"`
	Code          string    `json:"code"`
	CaptureID     string    `json:"captureId"`
	GrossWeightKg float64   `json:"grossWeightKg"`
	TareWeightKg  float64   `json:"tareWeightKg"`
	NetWeightKg   float64   `json:"netWeightKg"`
	CapturedAt    time.Time `json:"capturedAt"`
	Cancelled     bool      `json:"cancelled,omitempty"`
}
type receptionBatch struct {
	ID            string            `json:"id"`
	Code          string            `json:"code"`
	FarmerCode    string            `json:"farmerCode"`
	FarmerName    string            `json:"farmerName"`
	CreatedAt     time.Time         `json:"createdAt"`
	Items         []receptionWaring `json:"items"`
	GrossWeightKg float64           `json:"grossWeightKg"`
	TareWeightKg  float64           `json:"tareWeightKg"`
	NetWeightKg   float64           `json:"netWeightKg"`
}
type receptionError struct {
	status        int
	code, message string
}

func (e *receptionError) Error() string { return e.message }
func receptionFail(status int, code, message string) error {
	return &receptionError{status, code, message}
}
func receptionHTTPError(w http.ResponseWriter, err error) {
	var known *receptionError
	if errors.As(err, &known) {
		fail(w, known.status, known.code, known.message)
		return
	}
	slog.Error("reception request failed", "error", err)
	fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to process Reception")
}
func roundReceptionKg(v float64) float64 { return math.Round(v*1000) / 1000 }

func normalizeReception(input *receptionRequest) error {
	input.FarmerCode = strings.ToUpper(strings.TrimSpace(input.FarmerCode))
	if !receptionIDPattern.MatchString(input.ID) || input.FarmerCode == "" || len(input.Items) == 0 || len(input.Items) > 1000 {
		return receptionFail(400, "VALIDATION_ERROR", "A session ID, farmer code, and 1 to 1000 warings are required")
	}
	seen := map[string]bool{}
	for i := range input.Items {
		item := &input.Items[i]
		if !receptionIDPattern.MatchString(item.CaptureID) || seen[item.CaptureID] {
			return receptionFail(400, "VALIDATION_ERROR", "Each waring must have a unique capture ID")
		}
		seen[item.CaptureID] = true
		if math.IsNaN(item.GrossWeightKg) || math.IsInf(item.GrossWeightKg, 0) || item.GrossWeightKg > 1000000 || roundReceptionKg(item.GrossWeightKg) <= receptionTareKg || item.CapturedAt.IsZero() {
			return receptionFail(400, "VALIDATION_ERROR", "Each waring requires a valid time and gross weight greater than 1.2 kg")
		}
		item.GrossWeightKg = roundReceptionKg(item.GrossWeightKg)
		item.CapturedAt = item.CapturedAt.UTC()
	}
	return nil
}

func (s *server) receptionBatches(w http.ResponseWriter, r *http.Request, path []string) {
	owner, role, err := s.authenticatedClaims(r)
	if err != nil {
		fail(w, 401, "UNAUTHORIZED", "A valid operator authentication token is required")
		return
	}
	if role != "ADMIN" && role != "OPERATOR" {
		fail(w, 403, "FORBIDDEN", "Only operators and administrators can manage Reception")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	if len(path) == 0 && r.Method == http.MethodPost {
		var input receptionRequest
		if !decode(r, &input) {
			fail(w, 400, "VALIDATION_ERROR", "A valid Reception session is required")
			return
		}
		if err := normalizeReception(&input); err != nil {
			receptionHTTPError(w, err)
			return
		}
		result, created, err := s.saveReceptionBatch(r.Context(), owner, role, input)
		if err != nil {
			receptionHTTPError(w, err)
			return
		}
		status := 200
		if created {
			status = 201
		}
		writeStatus(w, status, response{Success: true, Data: result})
		return
	}
	if len(path) >= 1 && receptionIDPattern.MatchString(path[0]) {
		if len(path) == 1 && r.Method == http.MethodGet {
			batch, err := s.loadReceptionBatch(r.Context(), owner, role, path[0])
			if err != nil {
				receptionHTTPError(w, err)
				return
			}
			write(w, response{Success: true, Data: batch})
			return
		}
		if len(path) == 2 && path[1] == "print" && r.Method == http.MethodPost {
			var input struct {
				Document string `json:"document"`
				WaringID string `json:"waringId"`
			}
			if !decode(r, &input) {
				fail(w, 400, "VALIDATION_ERROR", "Select all, receipt, or label")
				return
			}
			batch, err := s.loadReceptionBatch(r.Context(), owner, role, path[0])
			if err != nil {
				receptionHTTPError(w, err)
				return
			}
			jobs, err := receptionPrintJobs(batch, input.Document, input.WaringID)
			if err != nil {
				receptionHTTPError(w, err)
				return
			}
			payload, err := encodePrintJobs(jobs)
			if err != nil {
				receptionHTTPError(w, err)
				return
			}
			s.printerMu.RLock()
			printer, ok := s.printers["reception"]
			s.printerMu.RUnlock()
			if !ok || net.ParseIP(printer.IP) == nil || printer.Port < 1 || printer.Port > 65535 {
				fail(w, 400, "PRINTER_NOT_CONFIGURED", "Configure the Reception printer first")
				return
			}
			if err := s.sendReceptionPayload(r.Context(), printer.IP, printer.Port, payload); err != nil {
				receptionHTTPError(w, err)
				return
			}
			write(w, response{Success: true, Data: map[string]any{"jobs": len(jobs), "message": "Reception documents sent to printer"}})
			return
		}
	}
	fail(w, 404, "NOT_FOUND", "Reception route not found")
}

func (s *server) saveReceptionBatch(ctx context.Context, owner, role string, input receptionRequest) (receptionBatch, bool, error) {
	var result receptionBatch
	body, err := json.Marshal(input)
	if err != nil {
		return result, false, fmt.Errorf("encode reception request: %w", err)
	}
	digest := sha256.Sum256(body)
	hash := hex.EncodeToString(digest[:])
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return result, false, fmt.Errorf("begin reception: %w", err)
	}
	defer tx.Rollback(ctx)
	var farmerID, farmerName string
	err = tx.QueryRow(ctx, `SELECT id,name FROM farmers WHERE UPPER(code)=$1`, input.FarmerCode).Scan(&farmerID, &farmerName)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, false, receptionFail(404, "FARMER_NOT_FOUND", "Farmer not found")
	}
	if err != nil {
		return result, false, fmt.Errorf("find reception farmer: %w", err)
	}
	tag, err := tx.Exec(ctx, `INSERT INTO reception_batches(id,"farmerId","operatorId","requestHash") VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`, input.ID, farmerID, owner, hash)
	if err != nil {
		return result, false, fmt.Errorf("create reception session: %w", err)
	}
	if tag.RowsAffected() == 0 {
		var savedHash string
		var savedOwner *string
		var raw []byte
		if err := tx.QueryRow(ctx, `SELECT "requestHash","operatorId",response FROM reception_batches WHERE id=$1`, input.ID).Scan(&savedHash, &savedOwner, &raw); err != nil {
			return result, false, fmt.Errorf("read reception retry: %w", err)
		}
		if role != "ADMIN" && (savedOwner == nil || *savedOwner != owner) {
			return result, false, receptionFail(403, "FORBIDDEN", "This Reception session belongs to another operator")
		}
		if savedHash != hash {
			return result, false, receptionFail(409, "SESSION_CONFLICT", "This session was already saved with different weights")
		}
		if err := json.Unmarshal(raw, &result); err != nil {
			return result, false, fmt.Errorf("decode reception retry: %w", err)
		}
		return result, false, nil
	}
	var capacity float64
	if err := tx.QueryRow(ctx, `SELECT capacity_kg FROM scale_settings WHERE station='01'`).Scan(&capacity); err != nil {
		return result, false, fmt.Errorf("load reception scale capacity: %w", err)
	}
	for _, item := range input.Items {
		if capacity <= 0 || item.GrossWeightKg > capacity {
			return result, false, receptionFail(400, "VALIDATION_ERROR", "Waring weight exceeds Reception scale capacity")
		}
	}
	var commodityID string
	if err := tx.QueryRow(ctx, `SELECT id FROM commodities WHERE code='001'`).Scan(&commodityID); err != nil {
		return result, false, fmt.Errorf("load reception commodity: %w", err)
	}
	now := time.Now().UTC()
	var sequence int64
	if err := tx.QueryRow(ctx, `SELECT nextval('waring_code_seq')`).Scan(&sequence); err != nil {
		return result, false, fmt.Errorf("allocate reception receipt: %w", err)
	}
	result = receptionBatch{ID: input.ID, Code: fmt.Sprintf("RCV-%s-%06d", now.Format("20060102"), sequence), FarmerCode: input.FarmerCode, FarmerName: farmerName, CreatedAt: now, Items: []receptionWaring{}}
	for _, item := range input.Items {
		if err := tx.QueryRow(ctx, `SELECT nextval('waring_code_seq')`).Scan(&sequence); err != nil {
			return result, false, fmt.Errorf("allocate waring: %w", err)
		}
		waring := receptionWaring{Code: fmt.Sprintf("WRG-%s-%06d", now.Format("20060102"), sequence), CaptureID: item.CaptureID, GrossWeightKg: item.GrossWeightKg, TareWeightKg: receptionTareKg, NetWeightKg: roundReceptionKg(item.GrossWeightKg - receptionTareKg), CapturedAt: item.CapturedAt}
		err := tx.QueryRow(ctx, `INSERT INTO warings(id,code,"farmerId","commodityId","operatorId","grossWeightKg","tareWeightKg","netWeightKg",status,"createdAt","receptionBatchId","captureId") VALUES(gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$9,$10) RETURNING id`, waring.Code, farmerID, commodityID, owner, waring.GrossWeightKg, waring.TareWeightKg, waring.NetWeightKg, waring.CapturedAt, input.ID, waring.CaptureID).Scan(&waring.ID)
		if err != nil {
			return result, false, fmt.Errorf("insert reception waring: %w", err)
		}
		result.Items = append(result.Items, waring)
		result.GrossWeightKg += waring.GrossWeightKg
		result.TareWeightKg += waring.TareWeightKg
		result.NetWeightKg += waring.NetWeightKg
	}
	result.GrossWeightKg = roundReceptionKg(result.GrossWeightKg)
	result.TareWeightKg = roundReceptionKg(result.TareWeightKg)
	result.NetWeightKg = roundReceptionKg(result.NetWeightKg)
	raw, err := json.Marshal(result)
	if err != nil {
		return result, false, fmt.Errorf("encode reception result: %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE reception_batches SET response=$2::jsonb WHERE id=$1`, input.ID, raw); err != nil {
		return result, false, fmt.Errorf("store reception result: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return result, false, fmt.Errorf("commit reception: %w", err)
	}
	slog.Info("Reception saved", "batch_id", result.ID, "warings", len(result.Items))
	return result, true, nil
}

func (s *server) loadReceptionBatch(ctx context.Context, owner, role, id string) (receptionBatch, error) {
	var batch receptionBatch
	var savedOwner *string
	var raw []byte
	err := s.db.QueryRow(ctx, `SELECT "operatorId",response FROM reception_batches WHERE id=$1`, id).Scan(&savedOwner, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return batch, receptionFail(404, "SESSION_NOT_FOUND", "Reception session not found")
	}
	if err != nil {
		return batch, fmt.Errorf("load reception session: %w", err)
	}
	if role != "ADMIN" && (savedOwner == nil || *savedOwner != owner) {
		return batch, receptionFail(403, "FORBIDDEN", "This Reception session belongs to another operator")
	}
	if err := json.Unmarshal(raw, &batch); err != nil {
		return batch, fmt.Errorf("decode reception session: %w", err)
	}
	rows, err := s.db.Query(ctx, `SELECT id FROM warings WHERE "receptionBatchId"=$1`, id)
	if err != nil {
		return batch, fmt.Errorf("load reception warings: %w", err)
	}
	defer rows.Close()
	live := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return batch, fmt.Errorf("scan reception waring: %w", err)
		}
		live[id] = true
	}
	if err := rows.Err(); err != nil {
		return batch, fmt.Errorf("read reception warings: %w", err)
	}
	for i := range batch.Items {
		batch.Items[i].Cancelled = !live[batch.Items[i].ID]
	}
	return batch, nil
}

func receptionPrintJobs(batch receptionBatch, document, waringID string) ([]printJob, error) {
	if document != "all" && document != "receipt" && document != "label" {
		return nil, receptionFail(400, "VALIDATION_ERROR", "Select all, receipt, or label")
	}
	for _, item := range batch.Items {
		if item.Cancelled && document != "label" {
			return nil, receptionFail(409, "SESSION_CHANGED", "This session contains cancelled warings; print remaining labels individually")
		}
	}
	jobs := []printJob{}
	if document != "label" {
		jobs = append(jobs, printJob{Type: "receipt", Code: batch.Code, FarmerName: batch.FarmerName, FarmerID: batch.FarmerCode, ReceiptItems: batch.Items, Date: batch.CreatedAt.Format("2006-01-02"), Time: batch.CreatedAt.Format("15:04:05")})
	}
	if document != "receipt" {
		for _, item := range batch.Items {
			if document == "label" && item.ID != waringID {
				continue
			}
			if item.Cancelled {
				return nil, receptionFail(409, "WARING_CANCELLED", "Cancelled warings cannot be printed")
			}
			jobs = append(jobs, printJob{Type: "waring", Code: item.Code, FarmerName: batch.FarmerName, FarmerID: batch.FarmerCode, WeightKg: item.GrossWeightKg, Date: item.CapturedAt.Format("2006-01-02"), Time: item.CapturedAt.Format("15:04:05")})
		}
	}
	if len(jobs) == 0 {
		return nil, receptionFail(404, "WARING_NOT_FOUND", "Waring not found in this session")
	}
	return jobs, nil
}

func formatReceptionReceipt(items []receptionWaring) string {
	var out strings.Builder
	fmt.Fprintf(&out, "Warings: %d\n", len(items))
	var gross, tare, netWeight float64
	for i, item := range items {
		fmt.Fprintf(&out, "%d. %s\n", i+1, item.Code)
		fmt.Fprintf(&out, "Gross %.3f  Tare %.3f kg\nNet %.3f kg\n", item.GrossWeightKg, item.TareWeightKg, item.NetWeightKg)
		gross += item.GrossWeightKg
		tare += item.TareWeightKg
		netWeight += item.NetWeightKg
	}
	fmt.Fprintf(&out, "--------------------------------\nTotal gross: %.3f kg\nTotal tare:  %.3f kg\nTotal net:   %.3f kg\n", roundReceptionKg(gross), roundReceptionKg(tare), roundReceptionKg(netWeight))
	return out.String()
}

// A failed write may have reached the printer. Never replay a partial batch automatically.
func (s *server) sendReceptionPayload(ctx context.Context, ip string, port int, payload []byte) error {
	value, _ := s.printerLocks.LoadOrStore(ip, &sync.Mutex{})
	lock := value.(*sync.Mutex)
	lock.Lock()
	defer lock.Unlock()
	dialer := net.Dialer{Timeout: 3 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(ip, fmt.Sprint(port)))
	if err != nil {
		return receptionFail(502, "PRINTER_UNREACHABLE", "Reception is saved. The printer is unreachable")
	}
	defer conn.Close()
	if err := conn.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
		return fmt.Errorf("set Reception printer deadline: %w", err)
	}
	stop := context.AfterFunc(ctx, func() { _ = conn.Close() })
	defer stop()
	if err := writeAll(conn, payload); err != nil {
		return receptionFail(502, "PRINT_DELIVERY_UNKNOWN", "Reception is saved. Check the printer before reprinting; some documents may have been sent")
	}
	return nil
}
