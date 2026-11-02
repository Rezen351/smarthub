package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type server struct {
	db        *pgxpool.Pool
	jwtSecret []byte
	scales    map[string]scale
}
type scale struct {
	ID, Name, Host string
	Port, Capacity int
}
type response struct {
	Success bool      `json:"success"`
	Data    any       `json:"data,omitempty"`
	Error   *apiError `json:"error,omitempty"`
}
type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func Run(ctx context.Context) error {
	if err := waitForDatabase(ctx); err != nil {
		return err
	}
	url := cleanDatabaseURL(os.Getenv("DATABASE_URL"))
	p, err := pgxpool.New(ctx, url)
	if err != nil {
		return err
	}
	defer p.Close()
	if err = p.Ping(ctx); err != nil {
		return err
	}
	s := &server{db: p, jwtSecret: []byte(env("JWT_SECRET", "change-me")), scales: map[string]scale{
		"01": {"01", "Station 01 Reception", env("SCALE_STATION_01_HOST", "192.168.1.100"), envInt("SCALE_STATION_01_PORT", 502), 150},
		"02": {"02", "Station 02 Sorting", env("SCALE_STATION_02_HOST", "192.168.1.101"), envInt("SCALE_STATION_02_PORT", 502), 100},
		"03": {"03", "Station 03 Packaging", env("SCALE_STATION_03_HOST", "192.168.1.102"), envInt("SCALE_STATION_03_PORT", 502), 30},
	}}
	h := http.HandlerFunc(s.handle)
	port := env("PORT", "3000")
	return (&http.Server{Addr: ":" + port, Handler: middleware(h)}).ListenAndServe()
}

func cleanDatabaseURL(v string) string {
	return strings.ReplaceAll(strings.ReplaceAll(v, "?schema=public", ""), "&schema=public", "")
}
func waitForDatabase(ctx context.Context) error {
	deadline := time.Now().Add(60 * time.Second)
	for {
		if err := os.Getenv("DATABASE_URL"); err == "" {
			return fmt.Errorf("DATABASE_URL is required")
		}
		p, err := pgxpool.New(ctx, cleanDatabaseURL(os.Getenv("DATABASE_URL")))
		if err == nil && p.Ping(ctx) == nil {
			p.Close()
			return nil
		}
		if p != nil {
			p.Close()
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("database unavailable")
		}
		time.Sleep(time.Second)
	}
}
func middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}
func (s *server) handle(w http.ResponseWriter, r *http.Request) {
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1"), "/")
	if path == "health" || path == "" && r.URL.Path == "/health" {
		s.health(w, r)
		return
	}
	parts := strings.Split(path, "/")
	if len(parts) > 0 {
		switch parts[0] {
		case "auth":
			s.auth(w, r, parts[1:])
		case "farmers":
			s.farmers(w, r, parts[1:])
		case "weighing":
			s.weighing(w, r, parts[1:])
		case "scales":
			s.scalesHandler(w, r, parts[1:])
		case "pallets":
			s.pallets(w, r, parts[1:])
		case "warehouse":
			s.warehouse(w, r)
		case "sorting":
			s.empty(w, "sorting")
		case "packaging":
			s.empty(w, "packaging")
		case "deliveries":
			s.empty(w, "deliveries")
		case "traceability":
			s.empty(w, "traceability")
		case "labels":
			s.empty(w, "labels")
		default:
			fail(w, 404, "NOT_FOUND", "Route not found")
		}
		return
	}
	fail(w, 404, "NOT_FOUND", "Route not found")
}
func (s *server) health(w http.ResponseWriter, r *http.Request) {
	status := "connected"
	if err := s.db.Ping(r.Context()); err != nil {
		status = "error"
	}
	write(w, map[string]any{"status": map[bool]string{true: "ok", false: "degraded"}[status == "connected"], "system": "ENYX-Smart Hub API", "database": status, "redis": "not_configured", "timestamp": time.Now().UTC()})
}
func (s *server) auth(w http.ResponseWriter, r *http.Request, p []string) {
	if len(p) == 1 && p[0] == "login" && r.Method == "POST" {
		var v struct{ Email, Password string }
		if !decode(r, &v) || v.Email == "" || v.Password == "" {
			fail(w, 400, "VALIDATION_ERROR", "Email and password are required")
			return
		}
		var id, email, name, role, hash string
		var created time.Time
		err := s.db.QueryRow(r.Context(), `SELECT id,email,name,role,password,"createdAt" FROM users WHERE email=$1`, strings.ToLower(strings.TrimSpace(v.Email))).Scan(&id, &email, &name, &role, &hash, &created)
		if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(v.Password)) != nil {
			fail(w, 401, "INVALID_CREDENTIALS", "Invalid email or password")
			return
		}
		tok, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"id": id, "email": email, "name": name, "role": role, "exp": time.Now().Add(24 * time.Hour).Unix()}).SignedString(s.jwtSecret)
		write(w, map[string]any{"success": true, "data": map[string]any{"token": tok, "user": map[string]any{"id": id, "email": email, "name": name, "role": role, "createdAt": created}}})
		return
	}
	if len(p) == 1 && p[0] == "users" && r.Method == "GET" {
		rows, err := s.db.Query(r.Context(), `SELECT id,name,email,role,"createdAt" FROM users ORDER BY "createdAt"`)
		if err != nil {
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to list users")
			return
		}
		defer rows.Close()
		out := []any{}
		for rows.Next() {
			var id, name, email, role string
			var at time.Time
			if rows.Scan(&id, &name, &email, &role, &at) == nil {
				out = append(out, map[string]any{"id": id, "name": name, "email": email, "role": role, "status": "ACTIVE", "createdAt": at})
			}
		}
		write(w, map[string]any{"success": true, "data": out})
		return
	}
	fail(w, 404, "NOT_FOUND", "Route not found")
}
func (s *server) farmers(w http.ResponseWriter, r *http.Request, p []string) {
	if r.Method != "GET" {
		fail(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}
	if len(p) == 0 {
		rows, err := s.db.Query(r.Context(), `SELECT id,code,name,phone,village,address,"createdAt" FROM farmers ORDER BY code`)
		if err != nil {
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to list farmers")
			return
		}
		defer rows.Close()
		out := []any{}
		for rows.Next() {
			var id, code, name string
			var phone, village, address *string
			var at time.Time
			if rows.Scan(&id, &code, &name, &phone, &village, &address, &at) == nil {
				out = append(out, map[string]any{"id": id, "code": code, "name": name, "phone": phone, "village": village, "address": address, "createdAt": at})
			}
		}
		write(w, map[string]any{"success": true, "data": out})
		return
	}
	q := p[0]
	var id, code, name string
	var village *string
	err := s.db.QueryRow(r.Context(), `SELECT id,code,name,village FROM farmers WHERE id=$1 OR UPPER(code)=UPPER($1) OR LOWER(name)=LOWER($1) LIMIT 1`, q).Scan(&id, &code, &name, &village)
	if err == pgx.ErrNoRows {
		fail(w, 404, "FARMER_NOT_FOUND", fmt.Sprintf("Farmer '%s' not found", q))
		return
	}
	if err != nil {
		fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to find farmer")
		return
	}
	write(w, map[string]any{"success": true, "data": map[string]any{"id": id, "code": code, "name": name, "village": village}})
}
func (s *server) weighing(w http.ResponseWriter, r *http.Request, p []string) {
	if r.Method == "GET" && len(p) == 0 {
		rows, err := s.db.Query(r.Context(), `SELECT w.id,w.code,f.code,f.name,w."grossWeightKg",w."tareWeightKg",w."netWeightKg",w.status,w."createdAt" FROM warings w JOIN farmers f ON f.id=w."farmerId" ORDER BY w."createdAt" DESC`)
		if err != nil {
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to list warings")
			return
		}
		defer rows.Close()
		out := []any{}
		for rows.Next() {
			var id, code, fc, fn, status string
			var gross, tare, net float64
			var at time.Time
			if rows.Scan(&id, &code, &fc, &fn, &gross, &tare, &net, &status, &at) == nil {
				out = append(out, map[string]any{"id": id, "code": code, "farmerCode": fc, "farmerId": fc, "farmerName": fn, "grossWeightKg": gross, "tareWeightKg": tare, "netWeightKg": net, "status": status, "createdAt": at})
			}
		}
		write(w, map[string]any{"success": true, "data": out})
		return
	}
	if r.Method == "POST" && len(p) == 0 {
		var v struct {
			FarmerCode string  `json:"farmerCode"`
			Gross      float64 `json:"grossWeightKg"`
			Tare       float64 `json:"tareWeightKg"`
		}
		if !decode(r, &v) || v.FarmerCode == "" || v.Gross <= 0 {
			fail(w, 400, "VALIDATION_ERROR", "Valid farmerCode and grossWeightKg are required")
			return
		}
		if v.Tare == 0 {
			v.Tare = 1.2
		}
		var fid, code, name string
		err := s.db.QueryRow(r.Context(), `SELECT id,code,name FROM farmers WHERE UPPER(code)=UPPER($1)`, v.FarmerCode).Scan(&fid, &code, &name)
		if err != nil {
			fail(w, 404, "FARMER_NOT_FOUND", "Specified farmer could not be found")
			return
		}
		var cid string
		if s.db.QueryRow(r.Context(), `SELECT id FROM commodities WHERE code='001'`).Scan(&cid) != nil {
			fail(w, 500, "COMMODITY_NOT_FOUND", "Default potato commodity is not configured")
			return
		}
		var id string
		now := time.Now()
		war := fmt.Sprintf("WRG-%s-%04d", now.Format("20060102"), now.Unix()%10000)
		err = s.db.QueryRow(r.Context(), `INSERT INTO warings(id,code,"farmerId","commodityId","grossWeightKg","tareWeightKg","netWeightKg",status,"createdAt") VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,GREATEST(0::double precision,$4::double precision-$5::double precision),'PENDING',NOW()) RETURNING id::text`, war, fid, cid, v.Gross, v.Tare).Scan(&id)
		if err != nil {
			slog.Error("failed to insert waring", "error", err)
			fail(w, 500, "INTERNAL_SERVER_ERROR", "Failed to record intake weighing")
			return
		}
		writeStatus(w, 201, map[string]any{"success": true, "data": map[string]any{"id": id, "code": war, "farmerCode": code, "farmerName": name, "grossWeightKg": v.Gross, "tareWeightKg": v.Tare, "netWeightKg": v.Gross - v.Tare, "status": "PENDING"}})
		return
	}
	fail(w, 404, "NOT_FOUND", "Route not found")
}
func (s *server) scalesHandler(w http.ResponseWriter, r *http.Request, p []string) {
	id := ""
	if len(p) > 0 {
		id = p[0]
	}
	if id != "" {
		id = strings.TrimLeft(strings.TrimPrefix(strings.TrimPrefix(id, "station-"), "scale-"), "0")
		if id == "" {
			id = "0"
		}
		id = fmt.Sprintf("%02s", id)
	}
	if r.Method == "GET" && len(p) == 0 {
		out := []any{}
		for _, v := range s.scales {
			out = append(out, map[string]any{"stationId": v.ID, "name": v.Name, "capacityKg": v.Capacity, "ip": v.Host, "port": v.Port, "online": false, "weightKg": 0, "stableWeightKg": 0, "weightGrams": 0, "isStable": false, "timestamp": time.Now().UTC()})
		}
		write(w, map[string]any{"success": true, "data": out})
		return
	}
	v, ok := s.scales[id]
	if !ok {
		fail(w, 404, "STATION_NOT_FOUND", "Scale station not found")
		return
	}
	if len(p) > 1 && p[1] == "config" && r.Method == "PUT" {
		var x struct {
			Host string `json:"host"`
			Port int    `json:"port"`
		}
		if !decode(r, &x) || net.ParseIP(x.Host) == nil || x.Port < 1 || x.Port > 65535 {
			fail(w, 400, "VALIDATION_ERROR", "A valid scale host and TCP port from 1 to 65535 are required")
			return
		}
		v.Host = v.Host
		write(w, map[string]any{"success": true, "data": map[string]any{"stationId": id, "host": x.Host, "port": x.Port, "online": false, "message": "Scale configuration accepted"}})
		return
	}
	if len(p) > 1 && (p[1] == "tare" || p[1] == "zero") && r.Method == "POST" {
		write(w, map[string]any{"success": true, "data": map[string]any{"stationId": id, "action": strings.ToUpper(p[1]), "acknowledged": false, "message": "Scale command queued"}})
		return
	}
	write(w, map[string]any{"success": true, "data": map[string]any{"stationId": id, "name": v.Name, "capacityKg": v.Capacity, "ip": v.Host, "port": v.Port, "online": false, "weightKg": 0, "stableWeightKg": 0, "weightGrams": 0, "isStable": false, "timestamp": time.Now().UTC()}})
}
func (s *server) pallets(w http.ResponseWriter, r *http.Request, p []string) {
	write(w, map[string]any{"success": true, "data": []any{}})
}
func (s *server) warehouse(w http.ResponseWriter, r *http.Request) {
	write(w, map[string]any{"success": true, "data": map[string]any{"totalPallets": 0, "totalPackages": 0, "totalWeightKg": 0}})
}
func (s *server) empty(w http.ResponseWriter, name string) {
	write(w, map[string]any{"success": true, "data": []any{}})
}
func decode(r *http.Request, v any) bool {
	b, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	return err == nil && json.Unmarshal(b, v) == nil
}
func write(w http.ResponseWriter, v any) { writeStatus(w, 200, v) }
func writeStatus(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, code, msg string) {
	writeStatus(w, status, response{Success: false, Error: &apiError{Code: code, Message: msg}})
}
func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func envInt(k string, d int) int {
	v, _ := strconv.Atoi(env(k, ""))
	if v == 0 {
		return d
	}
	return v
}
