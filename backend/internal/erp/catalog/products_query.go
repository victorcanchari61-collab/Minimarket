package catalog

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"minimarket/backend/internal/pagination"
)

// ProductFilter son los filtros, el orden y el cursor del listado de productos.
// Cada campo opcional vacío significa "sin filtro".
type ProductFilter struct {
	Search     string // nombre (contiene, sin acentos) o SKU (empieza por)
	SKU        string // contiene
	Name       string // contiene, sin acentos
	CategoryID *int64
	Status     ProductStatus
	PriceFrom  string
	PriceTo    string
	Sort       string // sku | name | price | status ("" = name)
	Desc       bool
	Cursor     string
}

// Solo estas columnas se pueden ordenar: cada una tiene su índice (columna, id)
// en la migración, y cualquier otra se rechaza antes de llegar aquí.
var productSorts = map[string]struct{ expr, cast string }{
	"sku":    {"p.sku", "text"},
	"name":   {"p.name", "text"},
	"price":  {"p.price", "numeric"},
	"status": {"p.status", "text"},
}

const defaultSort = "name"

// productCursor es la posición de la última fila entregada. Lleva el orden con
// el que se generó para rechazar un cursor viejo si el cliente cambió de orden.
type productCursor struct {
	Order string `json:"o"`
	Value string `json:"v"`
	ID    int64  `json:"id"`
}

func (f ProductFilter) sort() string {
	if _, ok := productSorts[f.Sort]; ok {
		return f.Sort
	}

	return defaultSort
}

func sortValue(p Product, sort string) string {
	switch sort {
	case "sku":
		return p.SKU
	case "price":
		return p.Price
	case "status":
		return string(p.Status)
	default:
		return p.Name
	}
}

// escapeLike evita que un % o _ escrito por el usuario actúe como comodín.
func escapeLike(text string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(text)
}

// ListProducts devuelve una página de MÁXIMO 20 productos, ordenada por cursor.
func (s *Store) ListProducts(ctx context.Context, f ProductFilter) (pagination.Page[Product], error) {
	var (
		args  []any
		where = []string{"p.deleted_at IS NULL"}
	)

	arg := func(value any) string {
		args = append(args, value)

		return "$" + strconv.Itoa(len(args))
	}

	const (
		nameMatch = `f_unaccent(lower(p.name)) LIKE '%%' || f_unaccent(lower(%s)) || '%%' ESCAPE '\'`
		skuPrefix = `lower(p.sku) LIKE lower(%s) || '%%' ESCAPE '\'`
		skuMatch  = `lower(p.sku) LIKE '%%' || lower(%s) || '%%' ESCAPE '\'`
	)

	if f.Search != "" {
		n := arg(escapeLike(f.Search))
		where = append(where, "("+fmt.Sprintf(nameMatch, n)+" OR "+fmt.Sprintf(skuPrefix, n)+")")
	}

	if f.Name != "" {
		where = append(where, fmt.Sprintf(nameMatch, arg(escapeLike(f.Name))))
	}

	if f.SKU != "" {
		where = append(where, fmt.Sprintf(skuMatch, arg(escapeLike(f.SKU))))
	}

	if f.CategoryID != nil {
		where = append(where, "p.category_id = "+arg(*f.CategoryID))
	}

	if f.Status != "" {
		where = append(where, "p.status = "+arg(string(f.Status)))
	}

	if f.PriceFrom != "" {
		where = append(where, "p.price >= "+arg(f.PriceFrom)+"::numeric")
	}

	if f.PriceTo != "" {
		where = append(where, "p.price <= "+arg(f.PriceTo)+"::numeric")
	}

	sort := f.sort()
	spec := productSorts[sort]
	direction, comparison := "ASC", ">"

	if f.Desc {
		direction, comparison = "DESC", "<"
	}

	order := sort + ":" + direction

	var cursor productCursor

	hasCursor, err := pagination.Decode(f.Cursor, &cursor)
	if err != nil || (hasCursor && cursor.Order != order) {
		return pagination.Page[Product]{}, invalidField("cursor", "El cursor no es válido.")
	}

	if hasCursor {
		where = append(where, "("+spec.expr+", p.id) "+comparison+
			" ("+arg(cursor.Value)+"::"+spec.cast+", "+arg(cursor.ID)+")")
	}

	query := productSelect +
		" WHERE " + strings.Join(where, " AND ") +
		" ORDER BY " + spec.expr + " " + direction + ", p.id " + direction +
		" LIMIT " + arg(pagination.Limit())

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return pagination.Page[Product]{}, err
	}
	defer rows.Close()

	products := make([]Product, 0, pagination.Limit())

	for rows.Next() {
		var (
			p      Product
			status string
		)

		if err := rows.Scan(&p.ID, &p.SKU, &p.Name, &p.Price, &status,
			&p.CategoryID, &p.Category, &p.UnitID, &p.Unit); err != nil {
			return pagination.Page[Product]{}, err
		}

		p.Status = ProductStatus(status)
		products = append(products, p)
	}

	if err := rows.Err(); err != nil {
		return pagination.Page[Product]{}, err
	}

	return pagination.Build(products, func(last Product) any {
		return productCursor{Order: order, Value: sortValue(last, sort), ID: last.ID}
	})
}
