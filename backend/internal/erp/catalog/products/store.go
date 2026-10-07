package products

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"minimarket/backend/internal/platform/database"
)

// Store es el único que escribe SQL de escritura en este paquete (los
// listados viven en products_query.go).
type Store struct {
	db database.Executor
}

func NewStore(db database.Executor) *Store {
	return &Store{db: db}
}

const productSelect = `
	SELECT p.id, p.sku, p.name, p.price::text, p.status,
	       p.category_id, c.name, p.unit_id, u.name
	FROM products p
	LEFT JOIN product_categories c ON c.id = p.category_id
	JOIN units u ON u.id = p.unit_id`

func scanProduct(row pgx.Row) (Product, error) {
	var (
		p      Product
		status string
	)

	err := row.Scan(&p.ID, &p.SKU, &p.Name, &p.Price, &status,
		&p.CategoryID, &p.Category, &p.UnitID, &p.Unit)
	if errors.Is(err, pgx.ErrNoRows) {
		return Product{}, errNotFound
	}

	p.Status = ProductStatus(status)

	return p, err
}

// translate convierte las violaciones de restricciones de PostgreSQL en
// errores propios, para que el servicio no conozca nombres de restricciones.
func translate(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return err
	}

	switch {
	case pgErr.Code == "23505" && pgErr.ConstraintName == "products_sku_unique":
		return errDuplicateSKU
	case pgErr.Code == "23503" && pgErr.ConstraintName == "products_category_id_fkey":
		return errUnknownCategory
	case pgErr.Code == "23503" && pgErr.ConstraintName == "products_unit_id_fkey":
		return errUnknownUnit
	default:
		return err
	}
}

func (s *Store) GetProduct(ctx context.Context, id int64) (Product, error) {
	return scanProduct(s.db.QueryRow(ctx,
		productSelect+` WHERE p.id = $1 AND p.deleted_at IS NULL`, id))
}

func (s *Store) InsertProduct(ctx context.Context, in ProductInput) (int64, error) {
	var id int64

	err := s.db.QueryRow(ctx, `
		INSERT INTO products (sku, name, category_id, unit_id, price, status)
		VALUES ($1, $2, $3, $4, $5::numeric, $6)
		RETURNING id`,
		in.SKU, in.Name, in.CategoryID, in.UnitID, in.Price, string(in.Status),
	).Scan(&id)

	return id, translate(err)
}

func (s *Store) UpdateProduct(ctx context.Context, id int64, in ProductInput) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE products
		SET sku = $2, name = $3, category_id = $4, unit_id = $5,
		    price = $6::numeric, status = $7, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id, in.SKU, in.Name, in.CategoryID, in.UnitID, in.Price, string(in.Status))
	if err != nil {
		return translate(err)
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

// SoftDeleteProduct marca el producto como eliminado: sigue existiendo para
// los documentos que ya lo usaron, pero desaparece de los listados y libera su SKU.
func (s *Store) SoftDeleteProduct(ctx context.Context, id int64) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE products SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

func (s *Store) Categories(ctx context.Context) ([]Category, error) {
	rows, err := s.db.Query(ctx, `SELECT id, name FROM product_categories ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Category{}

	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Name); err != nil {
			return nil, err
		}

		out = append(out, c)
	}

	return out, rows.Err()
}

func (s *Store) Summary(ctx context.Context) (Summary, error) {
	var sum Summary

	err := s.db.QueryRow(ctx, `
		SELECT count(*) FILTER (WHERE status = 'active'),
		       count(*) FILTER (WHERE status = 'inactive'),
		       count(DISTINCT category_id)
		FROM products WHERE deleted_at IS NULL`,
	).Scan(&sum.Active, &sum.Inactive, &sum.Categories)

	return sum, err
}
