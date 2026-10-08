package series

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"minimarket/backend/internal/platform/database"
)

type Store struct {
	db database.Executor
}

func NewStore(db database.Executor) *Store {
	return &Store{db: db}
}

const seriesSelect = `
	SELECT s.id, s.branch_id, b.name, s.terminal_id, COALESCE(t.name, ''), s.document_type, s.series,
	       s.next_number, s.active, s.created_at
	FROM document_series s
	JOIN branches b ON b.id = s.branch_id
	LEFT JOIN pos_terminals t ON t.id = s.terminal_id`

func scanSeries(row pgx.Row) (Series, error) {
	var (
		s    Series
		kind string
	)

	err := row.Scan(&s.ID, &s.BranchID, &s.BranchName, &s.TerminalID, &s.TerminalName, &kind, &s.Series,
		&s.NextNumber, &s.Active, &s.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Series{}, errNotFound
	}

	s.Type = DocumentType(kind)

	return s, err
}

func translate(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "document_series_unique" {
		return errDuplicate
	}

	return err
}

func (s *Store) Get(ctx context.Context, id int64) (Series, error) {
	return scanSeries(s.db.QueryRow(ctx, seriesSelect+` WHERE s.id = $1 AND s.deleted_at IS NULL`, id))
}

func (s *Store) BranchExists(ctx context.Context, id int64) (bool, error) {
	var ok bool

	err := s.db.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM branches WHERE id = $1 AND deleted_at IS NULL)`, id).Scan(&ok)

	return ok, err
}

// TerminalInBranch dice si la terminal existe y es de esa sucursal.
func (s *Store) TerminalInBranch(ctx context.Context, terminalID, branchID int64) (bool, error) {
	var ok bool

	err := s.db.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM pos_terminals WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL)`,
		terminalID, branchID).Scan(&ok)

	return ok, err
}

func (s *Store) Insert(ctx context.Context, in Input) (int64, error) {
	var id int64

	err := s.db.QueryRow(ctx, `
		INSERT INTO document_series (branch_id, terminal_id, document_type, series, next_number, active)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		in.BranchID, in.TerminalID, string(in.Type), in.Series, in.NextNumber, in.Active).Scan(&id)

	return id, translate(err)
}

// Update no toca el correlativo: lo mueve solo el sistema al emitir.
func (s *Store) Update(ctx context.Context, id int64, in Input) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE document_series
		SET branch_id = $2, terminal_id = $3, document_type = $4, series = $5, active = $6, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id, in.BranchID, in.TerminalID, string(in.Type), in.Series, in.Active)
	if err != nil {
		return translate(err)
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

func (s *Store) SoftDelete(ctx context.Context, id int64) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE document_series SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

func (s *Store) Branches(ctx context.Context) ([]BranchRef, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, code, name FROM branches WHERE active AND deleted_at IS NULL ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []BranchRef{}

	for rows.Next() {
		var b BranchRef
		if err := rows.Scan(&b.ID, &b.Code, &b.Name); err != nil {
			return nil, err
		}

		out = append(out, b)
	}

	return out, rows.Err()
}

func (s *Store) Terminals(ctx context.Context) ([]TerminalRef, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, branch_id, code, name FROM pos_terminals
		WHERE active AND deleted_at IS NULL ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []TerminalRef{}

	for rows.Next() {
		var t TerminalRef
		if err := rows.Scan(&t.ID, &t.BranchID, &t.Code, &t.Name); err != nil {
			return nil, err
		}

		out = append(out, t)
	}

	return out, rows.Err()
}

func (s *Store) Summary(ctx context.Context) (Summary, error) {
	var sum Summary

	err := s.db.QueryRow(ctx, `
		SELECT count(*) FILTER (WHERE active),
		       count(*) FILTER (WHERE NOT active),
		       count(*) FILTER (WHERE next_number > 1)
		FROM document_series WHERE deleted_at IS NULL`).Scan(&sum.Active, &sum.Inactive, &sum.Used)

	return sum, err
}
