package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/smartgeulis/smarthub/backend/internal/db"
	"github.com/smartgeulis/smarthub/backend/internal/httpapi"
)

func main() {
	ctx := context.Background()
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		if err := db.Migrate(ctx); err != nil {
			slog.Error("database migration failed", "error", err)
			os.Exit(1)
		}
		return
	}
	if err := httpapi.Run(ctx); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
