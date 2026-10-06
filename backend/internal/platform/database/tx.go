package database

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Executor lo implementan tanto *pgxpool.Pool como pgx.Tx: así un store
// funciona igual dentro y fuera de una transacción.
type Executor interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// InTx ejecuta fn dentro de una transacción: si fn devuelve un error (o
// entra en pánico) se revierte todo; si no, se confirma.
func InTx(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}

	defer func() { _ = tx.Rollback(ctx) }() // no hace nada si ya se confirmó

	if err := fn(tx); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
