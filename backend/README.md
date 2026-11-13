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

## Docker Compose

Compose starts `db-migrate` as a one-shot service before the backend. It applies pending migrations once and exits successfully; the backend starts only after that completion. Existing databases are detected and baselined safely.
