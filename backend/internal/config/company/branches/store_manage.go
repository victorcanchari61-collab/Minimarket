package branches

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const branchHead = `
	SELECT b.id, b.code, b.name, b.address, b.phone, COALESCE(b.sunat_code, ''), b.kind, b.active,`

const branchWarehouses = `
	       (SELECT count(*) FROM warehouses w WHERE w.branch_id = b.id AND w.deleted_at IS NULL),`

const branchUsers = `
	       (SELECT count(*) FROM user_branches ub
	        JOIN users u ON u.id = ub.user_id AND u.deleted_at IS NULL WHERE ub.branch_id = b.id),`

// branchSelectSQL arma el SELECT con o sin la cuenta de almacenes y de
// usuarios de cada sucursal; lo que no se pidió vale 0, sin calcularlo.
func branchSelectSQL(warehouses, users bool) string {
	sql := branchHead

	if warehouses {
		sql += branchWarehouses
	} else {
		sql += "\n\t       0::bigint,"
	}

	if users {
		sql += branchUsers
	} else {
		sql += "\n\t       0::bigint,"
	}

	return sql + "\n\t       b.created_at\n\tFROM branches b"
}

// branchSelect trae todo: para una sola sucursal.
var branchSelect = branchSelectSQL(true, true)

func scanBranch(row pgx.Row) (Branch, error) {
	var b Branch

	err := row.Scan(&b.ID, &b.Code, &b.Name, &b.Address, &b.Phone, &b.SunatCode, &b.Kind, &b.Active,
		&b.Warehouses, &b.Users, &b.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Branch{}, errNotFound
	}

	return b, err
}

// translate convierte las violaciones de restricciones de PostgreSQL en
// errores propios, para que el servicio no conozca nombres de restricciones.
func translate(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return err
	}

	switch pgErr.ConstraintName {
	case "branches_code_unique":
		return errDuplicateCode
	case "branches_sunat_unique":
		return errDuplicateSunat
	default:
		return err
	}
}

func (s *Store) Get(ctx context.Context, id int64) (Branch, error) {
	return scanBranch(s.db.QueryRow(ctx, branchSelect+` WHERE b.id = $1 AND b.deleted_at IS NULL`, id))
}

// Insert crea la sucursal en la empresa (hoy hay una).
func (s *Store) Insert(ctx context.Context, in Input) (int64, error) {
	var id int64

	err := s.db.QueryRow(ctx, `
		INSERT INTO branches (company_id, code, name, address, phone, sunat_code, kind, active)
		VALUES ((SELECT id FROM companies ORDER BY id LIMIT 1), $1, $2, $3, $4, NULLIF($5, ''), $6, $7)
		RETURNING id`,
		in.Code, in.Name, in.Address, in.Phone, in.SunatCode, string(in.Kind), in.Active).Scan(&id)

	return id, translate(err)
}

func (s *Store) Update(ctx context.Context, id int64, in Input) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE branches
		SET code = $2, name = $3, address = $4, phone = $5, sunat_code = NULLIF($6, ''),
		    kind = $7, active = $8, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id, in.Code, in.Name, in.Address, in.Phone, in.SunatCode, string(in.Kind), in.Active)
	if err != nil {
		return translate(err)
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

// SoftDelete marca la sucursal como eliminada: desaparece de los listados y
// libera su código.
func (s *Store) SoftDelete(ctx context.Context, id int64) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE branches SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

func (s *Store) Summary(ctx context.Context) (Summary, error) {
	var sum Summary

	err := s.db.QueryRow(ctx, `
		SELECT count(*) FILTER (WHERE active),
		       count(*) FILTER (WHERE NOT active),
		       count(*) FILTER (WHERE kind = 'store'),
		       count(*) FILTER (WHERE kind = 'distribution')
		FROM branches WHERE deleted_at IS NULL`,
	).Scan(&sum.Active, &sum.Inactive, &sum.Stores, &sum.Distribution)

	return sum, err
}
