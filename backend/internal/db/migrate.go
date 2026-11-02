package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Migrate(ctx context.Context) error {
	url := strings.ReplaceAll(strings.ReplaceAll(os.Getenv("DATABASE_URL"), "?schema=public", ""), "&schema=public", "")
	if url == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	p, err := pgxpool.New(ctx, url)
	if err != nil {
		return err
	}
	defer p.Close()
	if err = p.Ping(ctx); err != nil {
		return fmt.Errorf("database ping: %w", err)
	}
	if _, err = p.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`); err != nil {
		return err
	}
	var exists bool
	err = p.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users')`).Scan(&exists)
	if err != nil {
		return err
	}
	if exists {
		var count int
		if err = p.QueryRow(ctx, `SELECT COUNT(*) FROM schema_migrations WHERE version='0001_initial'`).Scan(&count); err != nil {
			return err
		}
		if count == 0 {
			if _, err = p.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES ('0001_initial') ON CONFLICT DO NOTHING`); err != nil {
				return err
			}
		}
	}
	dir := os.Getenv("MIGRATIONS_DIR")
	if dir == "" {
		dir = "migrations"
	}
	files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
	if err != nil {
		return err
	}
	sort.Strings(files)
	for _, file := range files {
		version := filepath.Base(file)
		version = version[:len(version)-4]
		var count int
		if err = p.QueryRow(ctx, `SELECT COUNT(*) FROM schema_migrations WHERE version=$1`, version).Scan(&count); err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		sql, err := os.ReadFile(file)
		if err != nil {
			return err
		}
		tx, err := p.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, string(sql)); err == nil {
			_, err = tx.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES ($1)`, version)
		}
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply %s: %w", version, err)
		}
		if err = tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}
