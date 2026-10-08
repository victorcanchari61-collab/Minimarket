package terminals

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"minimarket/backend/internal/platform/database"
)

// Store es el único que escribe SQL de escritura en este paquete (el listado
// vive en list_query.go).
type Store struct {
	db database.Executor
}

func NewStore(db database.Executor) *Store {
	return &Store{db: db}
}

const (
	terminalHead = `
	SELECT t.id, t.branch_id, b.name, t.warehouse_id, COALESCE(w.name, ''), t.code, t.name, t.active,`

	terminalSeries = `
	       (SELECT count(*) FROM document_series s WHERE s.terminal_id = t.id AND s.deleted_at IS NULL),`

	terminalFrom = `
	       t.created_at
	FROM pos_terminals t
	JOIN branches b ON b.id = t.branch_id
	LEFT JOIN warehouses w ON w.id = t.warehouse_id`
)

// terminalSelectSQL arma el SELECT con o sin la cuenta de series de cada
// terminal; lo que no se pidió vale 0, sin calcularlo.
func terminalSelectSQL(series bool) string {
	if series {
		return terminalHead + terminalSeries + terminalFrom
	}

	return terminalHead + "\n\t       0::bigint," + terminalFrom
}

// terminalSelect trae todo: para una sola terminal.
var terminalSelect = terminalSelectSQL(true)

func scanTerminal(row pgx.Row) (Terminal, error) {
	var t Terminal

	err := row.Scan(&t.ID, &t.BranchID, &t.BranchName, &t.WarehouseID, &t.WarehouseName,
		&t.Code, &t.Name, &t.Active, &t.Series, &t.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Terminal{}, errNotFound
	}

	return t, err
}

// translate convierte las violaciones de restricciones de PostgreSQL en
// errores propios, para que el servicio no conozca nombres de restricciones.
func translate(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "pos_terminals_code_unique" {
		return errDuplicateCode
	}

	return err
}

func (s *Store) Get(ctx context.Context, id int64) (Terminal, error) {
	return scanTerminal(s.db.QueryRow(ctx, terminalSelect+` WHERE t.id = $1 AND t.deleted_at IS NULL`, id))
}

// BranchIsStore dice si la sucursal existe, está activa y es una tienda: un
// centro de distribución no vende, así que no lleva cajas.
func (s *Store) BranchIsStore(ctx context.Context, id int64) (bool, error) {
	var ok bool

	err := s.db.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM branches WHERE id = $1 AND deleted_at IS NULL AND kind = 'store')`, id).Scan(&ok)

	return ok, err
}

// WarehouseInBranch dice si el almacén existe y es de esa sucursal.
func (s *Store) WarehouseInBranch(ctx context.Context, warehouseID, branchID int64) (bool, error) {
	var ok bool

	err := s.db.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM warehouses WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL)`,
		warehouseID, branchID).Scan(&ok)

	return ok, err
}

func (s *Store) Insert(ctx context.Context, in Input) (int64, error) {
	var id int64

	err := s.db.QueryRow(ctx, `
		INSERT INTO pos_terminals (branch_id, warehouse_id, code, name, active)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		in.BranchID, in.WarehouseID, in.Code, in.Name, in.Active).Scan(&id)

	return id, translate(err)
}

func (s *Store) Update(ctx context.Context, id int64, in Input) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE pos_terminals
		SET branch_id = $2, warehouse_id = $3, code = $4, name = $5, active = $6, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id, in.BranchID, in.WarehouseID, in.Code, in.Name, in.Active)
	if err != nil {
		return translate(err)
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

// SoftDelete marca la terminal como eliminada: desaparece de los listados y
// libera su código.
func (s *Store) SoftDelete(ctx context.Context, id int64) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE pos_terminals SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

// Branches son las tiendas activas donde se puede poner una caja.
func (s *Store) Branches(ctx context.Context) ([]BranchRef, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, code, name FROM branches
		WHERE active AND deleted_at IS NULL AND kind = 'store' ORDER BY name, id`)
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

// Warehouses son los almacenes activos, con su sucursal, para elegir el de la caja.
func (s *Store) Warehouses(ctx context.Context) ([]WarehouseRef, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, branch_id, name FROM warehouses
		WHERE active AND deleted_at IS NULL ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []WarehouseRef{}

	for rows.Next() {
		var w WarehouseRef
		if err := rows.Scan(&w.ID, &w.BranchID, &w.Name); err != nil {
			return nil, err
		}

		out = append(out, w)
	}

	return out, rows.Err()
}

func (s *Store) Summary(ctx context.Context) (Summary, error) {
	var sum Summary

	err := s.db.QueryRow(ctx, `
		SELECT (SELECT count(*) FROM pos_terminals WHERE deleted_at IS NULL AND active),
		       (SELECT count(*) FROM pos_terminals WHERE deleted_at IS NULL AND NOT active),
		       (SELECT count(*) FROM branches b
		        WHERE b.deleted_at IS NULL AND b.active AND b.kind = 'store'
		          AND NOT EXISTS (SELECT 1 FROM pos_terminals t
		                          WHERE t.branch_id = b.id AND t.deleted_at IS NULL AND t.active))`,
	).Scan(&sum.Active, &sum.Inactive, &sum.StoresWithout)

	return sum, err
}
