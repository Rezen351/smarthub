package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func receptionFixture() receptionRequest {
	return receptionRequest{ID: "session-1", FarmerCode: "FMR-001", Items: []receptionCapture{
		{CaptureID: "capture-1", GrossWeightKg: 40, CapturedAt: time.Date(2026, 11, 15, 8, 0, 0, 0, time.UTC)},
		{CaptureID: "capture-2", GrossWeightKg: 50, CapturedAt: time.Date(2026, 11, 15, 8, 1, 0, 0, time.UTC)},
		{CaptureID: "capture-3", GrossWeightKg: 60, CapturedAt: time.Date(2026, 11, 15, 8, 2, 0, 0, time.UTC)},
	}}
}
func TestReceptionValidation(t *testing.T) {
	for _, weight := range []float64{0, -1, 1.2, math.NaN(), math.Inf(1)} {
		input := receptionFixture()
		input.Items[0].GrossWeightKg = weight
		if err := normalizeReception(&input); err == nil {
			t.Fatalf("accepted invalid weight %v", weight)
		}
	}
	input := receptionFixture()
	input.Items[1].CaptureID = input.Items[0].CaptureID
	if err := normalizeReception(&input); err == nil {
		t.Fatal("accepted duplicate capture")
	}
}
func TestReceptionRequiresOperator(t *testing.T) {
	s := &server{jwtSecret: []byte("test-reception")}
	for _, role := range []string{"", "FARMER"} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/api/v1/weighing/batches", strings.NewReader(`{}`))
		expected := 401
		if role != "" {
			token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"id": "user", "role": role, "exp": time.Now().Add(time.Hour).Unix()}).SignedString(s.jwtSecret)
			if err != nil {
				t.Fatal(err)
			}
			req.Header.Set("Authorization", "Bearer "+token)
			expected = 403
		}
		s.handle(rec, req)
		if rec.Code != expected {
			t.Fatalf("role %q: got %d", role, rec.Code)
		}
	}
}

func TestReceptionBatchIntegration(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL is required for PostgreSQL integration tests")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, cleanDatabaseURL(url))
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("test_reception_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if _, err := admin.Exec(ctx, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE"); err != nil {
			t.Error(err)
		}
	}()
	config, err := pgxpool.ParseConfig(cleanDatabaseURL(url))
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	for _, file := range []string{"0001_initial.sql", "0004_scale_settings.sql", "0020_reception_batches.sql"} {
		migration, err := os.ReadFile("../../migrations/" + file)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, string(migration)); err != nil {
			t.Fatal(err)
		}
	}
	_, err = pool.Exec(ctx, `INSERT INTO users(id,email,name,password,role,"updatedAt") VALUES ('op-1','op1@test','Operator 1','test','OPERATOR',NOW()),('op-2','op2@test','Operator 2','test','OPERATOR',NOW()),('admin','admin@test','Admin','test','ADMIN',NOW()),('farmer','farmer@test','Farmer','test','FARMER',NOW());
 INSERT INTO farmers(id,code,name,"userId","updatedAt") VALUES('farmer-1','FMR-001','Farmer 1','farmer',NOW());
 INSERT INTO commodities(id,code,name) VALUES('potato','001','Potato');`)
	if err != nil {
		t.Fatal(err)
	}
	s := &server{db: pool, jwtSecret: []byte("test-reception")}
	call := func(owner, role, method, path string, body any) *httptest.ResponseRecorder {
		t.Helper()
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"id": owner, "role": role, "exp": time.Now().Add(time.Hour).Unix()}).SignedString(s.jwtSecret)
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest(method, path, bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		s.handle(rec, req)
		return rec
	}
	input := receptionFixture()
	rec := call("op-1", "OPERATOR", "POST", "/api/v1/weighing/batches", input)
	if rec.Code != 201 {
		t.Fatalf("save: %d %s", rec.Code, rec.Body.String())
	}
	var response struct {
		Data receptionBatch `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	batch := response.Data
	if len(batch.Items) != 3 || batch.GrossWeightKg != 150 || batch.TareWeightKg != 3.6 || batch.NetWeightKg != 146.4 {
		t.Fatalf("incorrect totals: %+v", batch)
	}
	codes := map[string]bool{}
	for _, item := range batch.Items {
		if codes[item.Code] {
			t.Fatal("duplicate waring code")
		}
		codes[item.Code] = true
	}
	rec = call("op-1", "OPERATOR", "POST", "/api/v1/weighing/batches", input)
	if rec.Code != 200 {
		t.Fatalf("retry: %d %s", rec.Code, rec.Body.String())
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM warings`).Scan(&count); err != nil || count != 3 {
		t.Fatalf("retry duplicated warings: %d, %v", count, err)
	}
	changed := receptionFixture()
	changed.Items[0].GrossWeightKg = 41
	if rec := call("op-1", "OPERATOR", "POST", "/api/v1/weighing/batches", changed); rec.Code != 409 {
		t.Fatalf("conflict: %d", rec.Code)
	}
	if rec := call("op-2", "OPERATOR", "GET", "/api/v1/weighing/batches/session-1", nil); rec.Code != 403 {
		t.Fatalf("owner RBAC: %d", rec.Code)
	}
	if rec := call("admin", "ADMIN", "GET", "/api/v1/weighing/batches/session-1", nil); rec.Code != 200 {
		t.Fatalf("admin read: %d", rec.Code)
	}
	invalid := receptionFixture()
	invalid.ID = "invalid-capacity"
	invalid.Items[2].GrossWeightKg = 151
	if rec := call("op-1", "OPERATOR", "POST", "/api/v1/weighing/batches", invalid); rec.Code != 400 {
		t.Fatalf("capacity: %d", rec.Code)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM reception_batches WHERE id='invalid-capacity'`).Scan(&count); err != nil || count != 0 {
		t.Fatal("failed session was partially saved")
	}
	// Force an insertion failure after the first row to verify transaction rollback.
	if _, err := pool.Exec(ctx, `ALTER TABLE warings ADD CONSTRAINT test_max_weight CHECK ("grossWeightKg"<80)`); err != nil {
		t.Fatal(err)
	}
	invalid = receptionFixture()
	invalid.ID = "rollback"
	invalid.Items[1].GrossWeightKg = 90
	if rec := call("op-1", "OPERATOR", "POST", "/api/v1/weighing/batches", invalid); rec.Code != 500 {
		t.Fatalf("expected insertion failure: %d", rec.Code)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM warings WHERE "receptionBatchId"='rollback'`).Scan(&count); err != nil || count != 0 {
		t.Fatal("partial warings survived rollback")
	}
	var group sync.WaitGroup
	failures := make(chan error, 4)
	concurrent := receptionFixture()
	concurrent.ID = "concurrent"
	for i := 0; i < 4; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			result, _, err := s.saveReceptionBatch(ctx, "op-1", "OPERATOR", concurrent)
			if err != nil {
				failures <- err
			} else if len(result.Items) != 3 {
				failures <- fmt.Errorf("incomplete concurrent response")
			}
		}()
	}
	group.Wait()
	close(failures)
	for err := range failures {
		t.Error(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM warings WHERE "receptionBatchId"='concurrent'`).Scan(&count); err != nil || count != 3 {
		t.Fatalf("concurrent retry count: %d, %v", count, err)
	}
	jobs, err := receptionPrintJobs(batch, "all", "")
	if err != nil {
		t.Fatal(err)
	}
	payload, err := encodePrintJobs(jobs)
	if err != nil {
		t.Fatal(err)
	}
	if len(jobs) != 4 || bytes.Count(payload, []byte("RECEIVING RECEIPT\n")) != 1 || bytes.Count(payload, []byte("WARING LABEL\n")) != 3 || bytes.Count(payload, []byte{0x1d, 0x56, 0x42, 0x03}) != 4 {
		t.Fatal("expected one receipt, three labels, four cuts")
	}
	for _, value := range []string{"Total gross: 150,000 kg", "Total tare:  3,600 kg", "Total net:   146,400 kg"} {
		if !bytes.Contains(payload, []byte(value)) {
			t.Fatalf("missing %s", value)
		}
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	address := listener.Addr().(*net.TCPAddr)
	s.printers = map[string]printerSettings{"reception": {IP: "127.0.0.1", Port: address.Port}}
	received := make(chan []byte, 1)
	go func() {
		connection, err := listener.Accept()
		if err != nil {
			received <- nil
			return
		}
		defer connection.Close()
		_ = connection.SetReadDeadline(time.Now().Add(5 * time.Second))
		var data bytes.Buffer
		_, _ = data.ReadFrom(connection)
		received <- data.Bytes()
	}()
	rec = call("op-1", "OPERATOR", "POST", "/api/v1/weighing/batches/session-1/print", map[string]string{"document": "all"})
	if rec.Code != 200 {
		t.Fatalf("printer endpoint: %d %s", rec.Code, rec.Body.String())
	}
	select {
	case sent := <-received:
		if !bytes.Equal(sent, payload) {
			t.Fatal("printer received incorrect documents")
		}
	case <-time.After(6 * time.Second):
		t.Fatal("printer simulation timed out")
	}
	label, err := receptionPrintJobs(batch, "label", batch.Items[1].ID)
	if err != nil || len(label) != 1 || label[0].Code != batch.Items[1].Code {
		t.Fatal("single label reprint failed")
	}
	if _, err := pool.Exec(ctx, `DELETE FROM warings WHERE id=$1`, batch.Items[0].ID); err != nil {
		t.Fatal(err)
	}
	updated, err := s.loadReceptionBatch(ctx, "op-1", "OPERATOR", batch.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := receptionPrintJobs(updated, "all", ""); err == nil {
		t.Fatal("printed a cancelled waring")
	}
	if jobs, err := receptionPrintJobs(updated, "label", batch.Items[1].ID); err != nil || len(jobs) != 1 {
		t.Fatal("remaining label cannot be reprinted")
	}
}
