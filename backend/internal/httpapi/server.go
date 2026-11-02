package httpapi

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type server struct {
	db        *pgxpool.Pool
	jwtSecret []byte
	scaleMu   sync.RWMutex
	scales    map[string]scale
	printerMu sync.RWMutex
	printers  map[string]printerSettings
}
type scale struct {
	ID, Name, Host string
	Port, Capacity int
}
type printerSettings struct {
	Station      string `json:"station"`
	Model        string `json:"model"`
	PaperWidthMm int    `json:"paperWidthMm"`
	Connection   string `json:"connection"`
	IP           string `json:"ip"`
	Port         int    `json:"port"`
	Protocol     string `json:"protocol"`
}
type printJob struct {
	Type       string  `json:"type"`
	Code       string  `json:"code"`
	FarmerName string  `json:"farmerName"`
	FarmerID   string  `json:"farmerId"`
	Grade      string  `json:"grade"`
	WeightKg   float64 `json:"weightKg"`
	Date       string  `json:"date"`
	Time       string  `json:"time"`
	Commodity  string  `json:"commodity"`
	Station    string  `json:"stationName"`
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
	s := &server{db: p, jwtSecret: []byte(env("JWT_SECRET", "change-me")), scales: map[string]scale{}}
	if err = s.loadScales(ctx); err != nil {
		return err
	}
	if err = s.loadPrinter(ctx); err != nil {
		return err
	}
	h := http.HandlerFunc(s.handle)
	port := env("PORT", "3000")
	return (&http.Server{Addr: ":" + port, Handler: middleware(h)}).ListenAndServe()
}

func (s *server) loadScales(ctx context.Context) error {
	rows, err := s.db.Query(ctx, `SELECT station,name,host,port,capacity_kg FROM scale_settings ORDER BY station`)
	if err != nil {
		return fmt.Errorf("load scale settings: %w", err)
	}
	defer rows.Close()
	scales := make(map[string]scale)
	for rows.Next() {
		var v scale
		if err = rows.Scan(&v.ID, &v.Name, &v.Host, &v.Port, &v.Capacity); err != nil {
			return fmt.Errorf("scan scale settings: %w", err)
		}
		scales[v.ID] = v
	}
	if err = rows.Err(); err != nil {
		return fmt.Errorf("read scale settings: %w", err)
	}
	if len(scales) == 0 {
		return fmt.Errorf("scale settings are not configured")
	}
	s.scaleMu.Lock()
	s.scales = scales
	s.scaleMu.Unlock()
	return nil
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
		case "printers":
			s.printerHandler(w, r, parts[1:])
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
	write(w, map[string]any{"status": map[bool]string{true: "ok", false: "degraded"}[status == "connected"], "system": "ENYX-Smart Hub API", "database": status, "timestamp": time.Now().UTC()})
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
		for _, id := range []string{"01", "02", "03"} {
			snapshot, ok := s.scaleSnapshot(r.Context(), id)
			if ok {
				out = append(out, snapshot)
			}
		}
		write(w, map[string]any{"success": true, "data": out})
		return
	}
	s.scaleMu.RLock()
	v, ok := s.scales[id]
	s.scaleMu.RUnlock()
	if !ok {
		fail(w, 404, "STATION_NOT_FOUND", "Scale station not found")
		return
	}
	if len(p) > 1 && p[1] == "config" && r.Method == "PUT" {
		var x struct {
			Host       string `json:"host"`
			Port       int    `json:"port"`
			CapacityKg int    `json:"capacityKg"`
		}
		if !decode(r, &x) || strings.TrimSpace(x.Host) == "" || x.Port < 1 || x.Port > 65535 || x.CapacityKg <= 0 {
			fail(w, 400, "VALIDATION_ERROR", "A valid scale host, TCP port, and maximum load are required")
			return
		}
		_, err := s.db.Exec(r.Context(), `UPDATE scale_settings SET host=$1,port=$2,capacity_kg=$3,updated_at=NOW() WHERE station=$4`, strings.TrimSpace(x.Host), x.Port, x.CapacityKg, id)
		if err != nil {
			fail(w, 500, "SCALE_SETTINGS_FAILED", "Failed to save scale settings")
			return
		}
		s.scaleMu.Lock()
		v.Host, v.Port, v.Capacity = strings.TrimSpace(x.Host), x.Port, x.CapacityKg
		s.scales[id] = v
		s.scaleMu.Unlock()
		write(w, map[string]any{"success": true, "data": map[string]any{"stationId": id, "host": v.Host, "port": v.Port, "online": false, "message": "Scale configuration accepted"}})
		return
	}
	if len(p) > 1 && p[1] == "test" && r.Method == "POST" {
		if _, err := s.scaleTelemetry(r.Context(), v); err != nil {
			write(w, map[string]any{"success": true, "data": map[string]any{"stationId": id, "online": false, "message": "Scale is unreachable"}})
			return
		}
		write(w, map[string]any{"success": true, "data": map[string]any{"stationId": id, "online": true, "message": "Scale is reachable"}})
		return
	}
	if len(p) > 1 && (p[1] == "tare" || p[1] == "zero") && r.Method == "POST" {
		write(w, map[string]any{"success": true, "data": map[string]any{"stationId": id, "action": strings.ToUpper(p[1]), "acknowledged": false, "message": "Scale command queued"}})
		return
	}
	snapshot, ok := s.scaleSnapshot(r.Context(), id)
	if !ok {
		write(w, map[string]any{"success": true, "data": map[string]any{"stationId": id, "name": v.Name, "capacityKg": v.Capacity, "ip": v.Host, "port": v.Port, "online": false, "weightKg": 0, "stableWeightKg": 0, "weightGrams": 0, "isStable": false, "timestamp": time.Now().UTC()}})
		return
	}
	write(w, map[string]any{"success": true, "data": snapshot})
}

func (s *server) scaleSnapshot(ctx context.Context, id string) (map[string]any, bool) {
	s.scaleMu.RLock()
	v, ok := s.scales[id]
	s.scaleMu.RUnlock()
	if !ok {
		return nil, false
	}
	telemetry, err := s.scaleTelemetry(ctx, v)
	if err != nil {
		return map[string]any{"stationId": v.ID, "name": v.Name, "capacityKg": v.Capacity, "ip": v.Host, "port": v.Port, "online": false, "weightKg": 0, "stableWeightKg": 0, "weightGrams": 0, "isStable": false, "timestamp": time.Now().UTC()}, true
	}
	telemetry["stationId"], telemetry["name"], telemetry["capacityKg"] = v.ID, v.Name, v.Capacity
	telemetry["ip"], telemetry["port"] = v.Host, v.Port
	return telemetry, true
}

func (s *server) scaleTelemetry(ctx context.Context, v scale) (map[string]any, error) {
	dialer := net.Dialer{Timeout: 1200 * time.Millisecond}
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(v.Host, strconv.Itoa(v.Port)))
	if err != nil {
		return nil, fmt.Errorf("connect scale %s: %w", v.ID, err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(1500 * time.Millisecond))

	request := []byte{0, 1, 0, 0, 0, 6, 1, 3, 0, 0, 0, 31}
	if _, err = conn.Write(request); err != nil {
		return nil, fmt.Errorf("request scale %s: %w", v.ID, err)
	}
	header := make([]byte, 7)
	if _, err = io.ReadFull(conn, header); err != nil {
		return nil, fmt.Errorf("read scale %s header: %w", v.ID, err)
	}
	length := int(binary.BigEndian.Uint16(header[4:6])) - 1
	if length < 2 || length > 252 {
		return nil, fmt.Errorf("invalid scale response length %d", length)
	}
	body := make([]byte, length)
	if _, err = io.ReadFull(conn, body); err != nil {
		return nil, fmt.Errorf("read scale %s body: %w", v.ID, err)
	}
	if body[0] != 3 || int(body[1]) != len(body)-2 {
		return nil, fmt.Errorf("invalid scale response payload")
	}
	registers := body[2:]
	if len(registers) < 62 {
		return nil, fmt.Errorf("incomplete scale register payload")
	}
	readFloat := func(index int) float64 {
		bits := uint32(binary.BigEndian.Uint16(registers[index*2:]))<<16 | uint32(binary.BigEndian.Uint16(registers[index*2+2:]))
		return float64(math.Float32frombits(bits))
	}
	status := binary.BigEndian.Uint16(registers[20:22])
	weightGrams := readFloat(0)
	return map[string]any{
		"online":         true,
		"weightKg":       weightGrams / 1000,
		"stableWeightKg": readFloat(2) / 1000,
		"weightGrams":    weightGrams,
		"isStable":       status&0x0010 != 0,
		"statusFlags":    fmt.Sprintf("0x%04x", status),
		"timestamp":      time.Now().UTC(),
	}, nil
}

func (s *server) loadPrinter(ctx context.Context) error {
	rows, err := s.db.Query(ctx, `SELECT station,model,paper_width_mm,connection,ip,port,protocol FROM printer_settings ORDER BY id`)
	if err != nil {
		return fmt.Errorf("load printer settings: %w", err)
	}
	defer rows.Close()
	printers := make(map[string]printerSettings)
	for rows.Next() {
		var station string
		var printer printerSettings
		if err = rows.Scan(&station, &printer.Model, &printer.PaperWidthMm, &printer.Connection, &printer.IP, &printer.Port, &printer.Protocol); err != nil {
			return fmt.Errorf("scan printer settings: %w", err)
		}
		if printer.IP == "" {
			printer.IP = env("THERMAL_PRINTER_"+station+"_IP", "")
		}
		printer.Station = station
		printers[strings.ToLower(station)] = printer
	}
	if err = rows.Err(); err != nil {
		return fmt.Errorf("read printer settings: %w", err)
	}
	s.printers = printers
	return nil
}

func (s *server) printerHandler(w http.ResponseWriter, r *http.Request, p []string) {
	if len(p) == 0 && r.Method == "GET" {
		s.printerMu.RLock()
		printers := make([]printerSettings, 0, len(s.printers))
		for _, station := range []string{"reception", "packaging"} {
			if printer, ok := s.printers[station]; ok {
				printers = append(printers, printer)
			}
		}
		s.printerMu.RUnlock()
		write(w, map[string]any{"success": true, "data": printers})
		return
	}
	station := ""
	if len(p) == 1 && (p[0] == "reception" || p[0] == "packaging") {
		station = p[0]
	}
	if station != "" && r.Method == "GET" {
		s.printerMu.RLock()
		printer, ok := s.printers[station]
		s.printerMu.RUnlock()
		if !ok {
			fail(w, 404, "PRINTER_NOT_FOUND", "Thermal printer not found")
			return
		}
		write(w, map[string]any{"success": true, "data": printer})
		return
	}
	if station != "" && r.Method == "PUT" {
		var input struct {
			IP   string `json:"ip"`
			Port int    `json:"port"`
		}
		if !decode(r, &input) || net.ParseIP(strings.TrimSpace(input.IP)) == nil || input.Port < 1 || input.Port > 65535 {
			fail(w, 400, "VALIDATION_ERROR", "A valid Ethernet printer IP address and TCP port are required")
			return
		}
		input.IP = strings.TrimSpace(input.IP)
		_, err := s.db.Exec(r.Context(), `UPDATE printer_settings SET ip=$1,port=$2,updated_at=NOW() WHERE station=$3`, input.IP, input.Port, strings.ToUpper(station))
		if err != nil {
			fail(w, 500, "PRINTER_SETTINGS_FAILED", "Failed to save thermal printer settings")
			return
		}
		s.printerMu.Lock()
		printer := s.printers[station]
		printer.IP, printer.Port = input.IP, input.Port
		s.printers[station] = printer
		s.printerMu.Unlock()
		write(w, map[string]any{"success": true, "data": printer})
		return
	}
	if len(p) == 2 && (p[0] == "reception" || p[0] == "packaging") && p[1] == "test" && r.Method == "POST" {
		s.printerMu.RLock()
		printer, ok := s.printers[p[0]]
		s.printerMu.RUnlock()
		if !ok {
			fail(w, 404, "PRINTER_NOT_FOUND", "Thermal printer not found")
			return
		}
		if net.ParseIP(printer.IP) == nil || printer.Port < 1 || printer.Port > 65535 {
			fail(w, 400, "PRINTER_NOT_CONFIGURED", "Configure a valid Ethernet printer address first")
			return
		}
		conn, err := net.DialTimeout("tcp", net.JoinHostPort(printer.IP, strconv.Itoa(printer.Port)), 1500*time.Millisecond)
		if err != nil {
			write(w, map[string]any{"success": true, "data": map[string]any{"online": false, "message": "Thermal printer is unreachable"}})
			return
		}
		_ = conn.Close()
		write(w, map[string]any{"success": true, "data": map[string]any{"online": true, "message": "Thermal printer is reachable"}})
		return
	}
	if len(p) == 2 && (p[0] == "reception" || p[0] == "packaging") && p[1] == "print" && r.Method == "POST" {
		s.printerMu.RLock()
		printer, ok := s.printers[p[0]]
		s.printerMu.RUnlock()
		if !ok {
			fail(w, 404, "PRINTER_NOT_FOUND", "Thermal printer not found")
			return
		}
		if net.ParseIP(printer.IP) == nil || printer.Port < 1 || printer.Port > 65535 {
			fail(w, 400, "PRINTER_NOT_CONFIGURED", "Configure a valid Ethernet printer address first")
			return
		}
		var input struct {
			Jobs []printJob `json:"jobs"`
		}
		if !decode(r, &input) || len(input.Jobs) == 0 || len(input.Jobs) > 4 {
			fail(w, 400, "VALIDATION_ERROR", "At least one valid print job is required")
			return
		}
		payload, err := encodePrintJobs(input.Jobs)
		if err != nil {
			fail(w, 400, "PRINT_JOB_INVALID", err.Error())
			return
		}
		conn, err := net.DialTimeout("tcp", net.JoinHostPort(printer.IP, strconv.Itoa(printer.Port)), 2*time.Second)
		if err != nil {
			fail(w, 502, "PRINTER_UNREACHABLE", "Thermal printer is unreachable")
			return
		}
		_ = conn.SetWriteDeadline(time.Now().Add(3 * time.Second))
		err = writeAll(conn, payload)
		_ = conn.Close()
		if err != nil {
			fail(w, 502, "PRINT_FAILED", "Failed to send print job to thermal printer")
			return
		}
		write(w, map[string]any{"success": true, "data": map[string]any{"station": p[0], "jobs": len(input.Jobs), "message": "Print job sent to thermal printer"}})
		return
	}
	fail(w, 404, "NOT_FOUND", "Printer route not found")
}

func writeAll(conn net.Conn, payload []byte) error {
	for len(payload) > 0 {
		written, err := conn.Write(payload)
		if err != nil {
			return err
		}
		if written == 0 {
			return io.ErrShortWrite
		}
		payload = payload[written:]
	}
	return nil
}

func encodePrintJobs(jobs []printJob) ([]byte, error) {
	var out []byte
	out = append(out, 0x1b, 0x40)
	labels := map[string]string{
		"receipt": "RECEIVING RECEIPT",
		"waring":  "WARING LABEL",
		"pallet":  "SORTING PALLET",
		"grade":   "SORTED PALLET",
		"pouch":   "POUCH LABEL",
		"export":  "EXPORT LABEL",
	}
	for index, job := range jobs {
		label, ok := labels[job.Type]
		if !ok || job.Code == "" {
			return nil, fmt.Errorf("print job type and code are required")
		}
		if index > 0 {
			out = append(out, 0x1b, 0x64, 0x04)
		}
		out = append(out, 0x1b, 0x61, 0x01)
		out = appendText(out, "ENYX-ENTERPRISE\n")
		out = appendText(out, label+"\n")
		out = appendText(out, "--------------------------------\n")
		out = append(out, 0x1b, 0x61, 0x00)
		if job.FarmerName != "" {
			out = appendText(out, "Farmer: "+job.FarmerName+"\n")
		}
		if job.FarmerID != "" {
			out = appendText(out, "Farmer ID: "+job.FarmerID+"\n")
		}
		if job.Grade != "" {
			out = appendText(out, "Grade: "+job.Grade+"\n")
		}
		if job.Type == "receipt" {
			commodity := job.Commodity
			if commodity == "" {
				commodity = "Potatoes"
			}
			out = appendText(out, "Commodity: "+commodity+"\n")
		}
		if job.Station != "" {
			out = appendText(out, "Station: "+job.Station+"\n")
		}
		out = append(out, 0x1b, 0x61, 0x01)
		out = appendText(out, "--------------------------------\n")
		if job.WeightKg > 0 {
			out = appendText(out, fmt.Sprintf("%.3f kg\n", job.WeightKg))
		}
		out = appendText(out, job.Code+"\n")
		out = appendText(out, "--------------------------------\n")
		if job.Type != "receipt" {
			out = appendCode128(out, job.Code)
			out = appendText(out, "\n")
			out = appendQR(out, job.Code)
		}
		if job.Date != "" || job.Time != "" {
			out = appendText(out, strings.TrimSpace(job.Date+" "+job.Time)+"\n")
		}
		if job.Type == "receipt" {
			out = appendText(out, "BUFFER_WAITING\n")
		} else {
			out = appendText(out, "PRINTED\n")
		}
		out = appendText(out, "\n")
	}
	out = append(out, 0x1d, 0x56, 0x42, 0x03)
	return out, nil
}

func appendText(dst []byte, value string) []byte {
	return append(dst, []byte(strings.Map(func(r rune) rune {
		if r >= 32 && r <= 126 || r == '\n' || r == '\r' || r == '\t' {
			return r
		}
		return '?'
	}, value))...)
}

func appendCode128(dst []byte, value string) []byte {
	data := "{B" + value
	dst = append(dst, 0x1d, 0x77, 0x02, 0x1d, 0x68, 0x20, 0x1d, 0x48, 0x00)
	dst = append(dst, 0x1d, 0x6b, 0x49, byte(len(data)))
	return appendText(dst, data)
}

func appendQR(dst []byte, value string) []byte {
	data := []byte(value)
	length := len(data) + 3
	dst = append(dst, 0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)
	// Use the normal module size so the QR fits within the label's 80 mm paper width.
	dst = append(dst, 0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x0a)
	dst = append(dst, 0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31)
	dst = append(dst, 0x1d, 0x28, 0x6b, byte(length), byte(length>>8), 0x31, 0x50, 0x30)
	dst = append(dst, data...)
	return append(dst, 0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30)
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
