package warehouses

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

const warehouseSelect = `
	SELECT w.id, w.branch_id, b.name, w.code, w.name, w.address, w.active, w.created_at
	FROM warehouses w
	JOIN branches b ON b.id = w.branch_id`

func scanWarehouse(row pgx.Row) (Warehouse, error) {
	var w Warehouse

	err := row.Scan(&w.ID, &w.BranchID, &w.BranchName, &w.Code, &w.Name, &w.Address, &w.Active, &w.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Warehouse{}, errNotFound
	}

	return w, err
}

// translate convierte las violaciones de restricciones de PostgreSQL en
// errores propios, para que el servicio no conozca nombres de restricciones.
func translate(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return err
	}

	switch {
	case pgErr.Code == "23505" && pgErr.ConstraintName == "warehouses_code_unique":
		return errDuplicateCode
	case pgErr.Code == "23503" && pgErr.ConstraintName == "warehouses_branch_id_fkey":
		return errUnknownBranch
	default:
		return err
	}
}

func (s *Store) Get(ctx context.Context, id int64) (Warehouse, error) {
	return scanWarehouse(s.db.QueryRow(ctx, warehouseSelect+` WHERE w.id = $1 AND w.deleted_at IS NULL`, id))
}

// BranchExists dice si la sucursal existe (y no está eliminada).
func (s *Store) BranchExists(ctx context.Context, id int64) (bool, error) {
	var exists bool

	err := s.db.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM branches WHERE id = $1 AND deleted_at IS NULL)`, id).Scan(&exists)

	return exists, err
}

func (s *Store) Insert(ctx context.Context, in Input) (int64, error) {
	var id int64

	err := s.db.QueryRow(ctx, `
		INSERT INTO warehouses (branch_id, code, name, address, active)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		in.BranchID, in.Code, in.Name, in.Address, in.Active).Scan(&id)

	return id, translate(err)
}

func (s *Store) Update(ctx context.Context, id int64, in Input) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE warehouses
		SET branch_id = $2, code = $3, name = $4, address = $5, active = $6, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id, in.BranchID, in.Code, in.Name, in.Address, in.Active)
	if err != nil {
		return translate(err)
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

// SoftDelete marca el almacén como eliminado: desaparece de los listados y
// libera su código.
func (s *Store) SoftDelete(ctx context.Context, id int64) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE warehouses SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

// Branches son las sucursales activas donde se puede poner un almacén.
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

func (s *Store) Summary(ctx context.Context) (Summary, error) {
	var sum Summary

	err := s.db.QueryRow(ctx, `
		SELECT (SELECT count(*) FROM warehouses WHERE deleted_at IS NULL AND active),
		       (SELECT count(*) FROM warehouses WHERE deleted_at IS NULL AND NOT active),
		       (SELECT count(*) FROM branches b WHERE b.deleted_at IS NULL AND b.active
		        AND NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.branch_id = b.id AND w.deleted_at IS NULL))`,
	).Scan(&sum.Active, &sum.Inactive, &sum.BranchesWithout)

	return sum, err
}
