package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPackagingRequiresOperator(t *testing.T) {
	s := &server{jwtSecret: []byte("test-packaging")}
	for _, role := range []string{"", "FARMER"} {
		for _, path := range []string{"/api/v1/packaging/products", "/api/v1/packaging/pack", "/api/v1/printers/packaging/print"} {
			req := httptest.NewRequest("POST", path, bytes.NewBufferString(`{}`))
			expected := 401
			if role != "" {
				token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"id": "test", "role": role, "exp": time.Now().Add(time.Hour).Unix()}).SignedString(s.jwtSecret)
				if err != nil {
					t.Fatal(err)
				}
				req.Header.Set("Authorization", "Bearer "+token)
				expected = 403
			}
			rec := httptest.NewRecorder()
			s.handle(rec, req)
			if rec.Code != expected {
				t.Fatalf("%s: got %d, expected %d", path, rec.Code, expected)
			}
		}
	}
}

func TestPackagingSnapshotIntegration(t *testing.T) {
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
	schema := fmt.Sprintf("test_packaging_%d", time.Now().UnixNano())
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
	for _, file := range []string{"0001_initial.sql", "0005_physical_pallets.sql", "0013_delivery_verification.sql", "0018_pallet_remainder_handling.sql", "0021_packaging_products.sql"} {
		sql, err := os.ReadFile("../../migrations/" + file)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, string(sql)); err != nil {
			t.Fatalf("%s: %v", file, err)
		}
	}
	if _, err := pool.Exec(ctx, `INSERT INTO users(id,email,name,password,role,"updatedAt") VALUES ('u','u@test','Farmer','test','FARMER',NOW());
 INSERT INTO farmers(id,code,name,"userId","updatedAt") VALUES('f','FMR-TEST','Farmer','u',NOW());
 INSERT INTO commodities(id,code,name) VALUES('c','potato','Potato');
 INSERT INTO warings(id,code,"farmerId","commodityId","grossWeightKg","netWeightKg") VALUES('w','WRG-TEST','f','c',21,20);
 INSERT INTO sorting_batches(id,"waringId","washDecision") VALUES('s','w','WASHED');
 UPDATE pallets SET grade='A',"farmerId"='f',"sortingBatchId"='s',status='IN_USE',"weightKg"=10,"remainingKg"=10 WHERE code='PLT-001';`); err != nil {
		t.Fatal(err)
	}
	s := &server{db: pool, jwtSecret: []byte("test-packaging"), scales: map[string]scale{"03": {Capacity: 30}}}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"id": "u", "role": "OPERATOR", "exp": time.Now().Add(time.Hour).Unix()}).SignedString(s.jwtSecret)
	if err != nil {
		t.Fatal(err)
	}
	call := func(method, path string, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		s.handle(rec, req)
		return rec
	}
	catalog := call("GET", "/api/v1/packaging/products", "")
	var catalogResponse struct {
		Data []packagingProduct `json:"data"`
	}
	if err := json.Unmarshal(catalog.Body.Bytes(), &catalogResponse); err != nil || catalog.Code != 200 || len(catalogResponse.Data) != 6 {
		t.Fatalf("catalog: %s, %v", catalog.Body, err)
	}
	for i, p := range catalogResponse.Data {
		if p.GTINValid != (i == 0) {
			t.Fatalf("invalid catalog status %+v", p)
		}
	}
	for _, body := range []string{
		`{"palletCode":"PLT-001","productNumber":"002","quantity":1,"totalNetWeightKg":10}`,
		`{"palletCode":"PLT-001","productNumber":"001","quantity":1,"totalNetWeightKg":9}`,
		`{"palletCode":"PLT-001","productNumber":"001","quantity":2,"totalNetWeightKg":10}`,
	} {
		rec := call("POST", "/api/v1/packaging/pack", body)
		if rec.Code != 400 {
			t.Fatalf("accepted invalid request: %d %s", rec.Code, rec.Body)
		}
	}
	var remaining float64
	var count int
	if err := pool.QueryRow(ctx, `SELECT "remainingKg" FROM pallets WHERE code='PLT-001'`).Scan(&remaining); err != nil || remaining != 10 {
		t.Fatalf("invalid request changed stock: %v %v", remaining, err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM package_units`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("invalid request created packages: %v %v", count, err)
	}
	if _, err := pool.Exec(ctx, `UPDATE pallets SET "sortingBatchId"=NULL WHERE code='PLT-001'`); err != nil {
		t.Fatal(err)
	}
	if rec := call("POST", "/api/v1/packaging/pack", `{"palletCode":"PLT-001","productNumber":"001","quantity":1,"totalNetWeightKg":10}`); rec.Code != 400 {
		t.Fatal("accepted missing Sorting source")
	}
	if _, err := pool.Exec(ctx, `UPDATE pallets SET "sortingBatchId"='s' WHERE code='PLT-001'`); err != nil {
		t.Fatal(err)
	}
	s.scales["03"] = scale{Capacity: 5}
	if rec := call("POST", "/api/v1/packaging/pack", `{"palletCode":"PLT-001","productNumber":"001","quantity":1,"totalNetWeightKg":10}`); rec.Code != 400 {
		t.Fatal("accepted insufficient scale capacity")
	}
	s.scales["03"] = scale{Capacity: 30}
	// A valid product must also match the source wash status.
	if _, err := pool.Exec(ctx, `UPDATE sorting_batches SET "washDecision"='UNWASHED' WHERE id='s'`); err != nil {
		t.Fatal(err)
	}
	if rec := call("POST", "/api/v1/packaging/pack", `{"palletCode":"PLT-001","productNumber":"001","quantity":1,"totalNetWeightKg":10}`); rec.Code != 400 {
		t.Fatal("accepted wrong washing status")
	}
	if _, err := pool.Exec(ctx, `UPDATE sorting_batches SET "washDecision"='WASHED' WHERE id='s'`); err != nil {
		t.Fatal(err)
	}
	rec := call("POST", "/api/v1/packaging/pack", `{"palletCode":"PLT-001","productNumber":"001","quantity":1,"totalNetWeightKg":10}`)
	if rec.Code != 201 {
		t.Fatalf("save: %d %s", rec.Code, rec.Body)
	}
	var saved struct {
		Data struct {
			Code    string           `json:"packageCode"`
			Product packagingProduct `json:"product"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &saved); err != nil {
		t.Fatal(err)
	}
	if saved.Data.Product.GTIN != "8994477090010" {
		t.Fatal("wrong saved product")
	}
	if err := pool.QueryRow(ctx, `SELECT "remainingKg" FROM pallets WHERE code='PLT-001'`).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("stock not depleted: %v %v", remaining, err)
	}
	// Catalog edits and pallet reuse must never rewrite the label identity.
	if _, err := pool.Exec(ctx, `UPDATE packaging_products SET gtin='4006381333931',"productName"='Changed' WHERE "productNumber"='001'; UPDATE pallets SET "sortingBatchId"=NULL,grade=NULL WHERE code='PLT-001'`); err != nil {
		t.Fatal(err)
	}
	job, err := s.packagePrintJob(ctx, saved.Data.Code)
	if err != nil {
		t.Fatal(err)
	}
	if job.Product.GTIN != "8994477090010" || job.Product.ProductName != "Washed potatoes 10 kg" || job.Grade != "A" {
		t.Fatalf("snapshot changed: %+v", job)
	}
	if _, err := encodePrintJobs([]printJob{job}); err != nil {
		t.Fatal(err)
	}
	records := call("GET", "/api/v1/packaging/records", "")
	if records.Code != 200 || !bytes.Contains(records.Body.Bytes(), []byte("8994477090010")) {
		t.Fatalf("records lost snapshot: %s", records.Body)
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	s.printers = map[string]printerSettings{"packaging": {IP: "127.0.0.1", Port: listener.Addr().(*net.TCPAddr).Port}}
	printed := make(chan []byte, 1)
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			printed <- nil
			return
		}
		defer conn.Close()
		if err := conn.SetReadDeadline(time.Now().Add(5 * time.Second)); err != nil {
			printed <- nil
			return
		}
		payload, err := io.ReadAll(conn)
		if err != nil {
			printed <- nil
			return
		}
		printed <- payload
	}()
	rec = call("POST", "/api/v1/printers/packaging/print", fmt.Sprintf(`{"jobs":[{"type":"export","code":%q,"weightKg":99,"grade":"C","product":{"gtin":"4006381333931","productName":"Forged"}}]}`, saved.Data.Code))
	if rec.Code != 200 {
		t.Fatalf("print: %d %s", rec.Code, rec.Body)
	}
	select {
	case payload := <-printed:
		if !bytes.Contains(payload, []byte("8994477090010")) || bytes.Contains(payload, []byte("Forged")) || bytes.Contains(payload, []byte("4006381333931")) || bytes.Contains(payload, []byte{0x1d, 0x28, 0x6b}) {
			t.Fatalf("printer ignored persisted snapshot: %q", payload)
		}
	case <-time.After(6 * time.Second):
		t.Fatal("print payload not received")
	}
	if _, err := pool.Exec(ctx, `UPDATE package_units SET "productSnapshot"=NULL`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.packagePrintJob(ctx, saved.Data.Code); err == nil {
		t.Fatal("legacy label accepted without snapshot")
	}
}
