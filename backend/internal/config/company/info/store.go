package info

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"minimarket/backend/internal/platform/database"
)

// Store es el único que escribe SQL en este paquete.
type Store struct {
	db database.Executor
}

func NewStore(db database.Executor) *Store {
	return &Store{db: db}
}

const companySelect = `
	SELECT id, COALESCE(ruc, ''), legal_name, trade_name, fiscal_address, phone, email, updated_at
	FROM companies`

// Get devuelve la empresa (la primera: hoy hay una).
func (s *Store) Get(ctx context.Context) (Company, error) {
	var c Company

	err := s.db.QueryRow(ctx, companySelect+` ORDER BY id LIMIT 1`).Scan(
		&c.ID, &c.RUC, &c.LegalName, &c.TradeName, &c.FiscalAddress, &c.Phone, &c.Email, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Company{}, errNotFound
	}

	return c, err
}

func (s *Store) Update(ctx context.Context, id int64, in Input) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE companies
		SET ruc = NULLIF($2, ''), legal_name = $3, trade_name = $4, fiscal_address = $5,
		    phone = $6, email = $7, updated_at = now()
		WHERE id = $1`,
		id, in.RUC, in.LegalName, in.TradeName, in.FiscalAddress, in.Phone, in.Email)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "companies_ruc_unique" {
			return errDuplicateRUC
		}

		return err
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}
