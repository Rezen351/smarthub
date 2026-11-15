# SmartGeulis Backend

The backend is a Go REST API for SmartGeulis. It uses PostgreSQL and keeps the `/api/v1` contract used by the React frontend.

## Local development

```bash
cp .env.example .env
go mod download
go run ./cmd/server migrate
go run ./cmd/server
```

The migration command is idempotent and records applied versions in `schema_migrations`.

## Project structure

```text
backend/
├── cmd/server/main.go          # Application and migration entrypoint
├── internal/db/migrate.go      # Idempotent SQL migration runner
├── internal/httpapi/server.go  # REST handlers and response wrapper
├── migrations/                 # Versioned PostgreSQL migrations
├── Dockerfile                  # Multi-stage Go production image
└── go.mod                      # Go dependencies
```

## API contract

Successful responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "error": { "code": "...", "message": "..." } }`. All API messages are in English.

`GET /api/v1/farmers/{idOrCode}/summary` returns the farmer's cumulative Reception net weight, including PENDING, APPROVED, and SORTED records. Sorting and Packaging do not reduce this total. Cancelled intake records are deleted and therefore excluded. The response includes `farmerId` (farmer code), `farmerName`, `totalDeposited` (kg), and `commodities` (`commodityId`, `commodityName`, `commodityCode`, `unit`, `totalKg`). A farmer without intake receives zero and an empty array; an unknown farmer receives `404 FARMER_NOT_FOUND`. The dashboard refreshes every five seconds while visible and on focus.

Run `go test ./...` for backend tests. Set `DATABASE_URL` to a PostgreSQL test instance to include the farmer summary integration tests; their fixtures use session-local temporary tables.

## Reception sessions

- `POST /api/v1/weighing/batches`: authenticated OPERATOR/ADMIN; accepts `{ "id": "client-session-id", "farmerCode": "FMR-001", "items": [{ "captureId": "capture-id", "grossWeightKg": 40, "capturedAt": "2026-11-15T08:00:00Z" }] }`. Sessions contain 1–1000 warings. Gross weight must exceed 1.2 kg and fit the configured Reception scale capacity. The server applies 1.2 kg tare per waring.
- Saves all warings in one transaction and returns the batch ID, receipt code, farmer, items with server IDs/codes and gross/tare/net weights, and session totals. First save returns 201; an identical retry returns 200 with the same result. Reusing an ID with different contents returns 409 `SESSION_CONFLICT`. Waring codes use a database sequence shared with single-waring intake.
- `GET /api/v1/weighing/batches/{id}`: loads the saved session, including cancellation flags. Access is limited to the owning operator or an administrator. `/weighing` includes nullable `receptionBatchId` for history reprints.
- `POST /api/v1/weighing/batches/{id}/print`: accepts `{ "document": "all" }`, `{ "document": "receipt" }`, or `{ "document": "label", "waringId": "server-waring-id" }`. Documents are constructed from saved data. All prints one summary receipt followed by one QR label per waring, cutting after each document under a single printer lock. A cancelled session cannot print a misleading full receipt; remaining labels can be printed individually.
- Printing does not change saved intake. A failed TCP write is not automatically replayed because delivery may be partial. Success means sent to the printer, not physically confirmed.
- Frontend drafts are scoped to the operator in tab-local session storage. Stable readings fill the field after three valid samples; assigning the next waring requires two empty-scale samples before another automatic fill. Manual input remains available. Only Finish submits the session. Ambiguous save failures freeze the submitted snapshot for an idempotent retry; restored drafts require Resume for automatic fill.

## Docker Compose

Compose starts `db-migrate` as a one-shot service before the backend. It applies pending migrations once and exits successfully; the backend starts only after that completion. Existing databases are detected and baselined safely.
