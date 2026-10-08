package warehouses

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"minimarket/backend/internal/pagination"
)

// Solo estas columnas se pueden ordenar: cada una tiene su índice (columna, id)
// en la migración, y cualquier otra se rechaza antes de llegar aquí.
var warehouseSorts = map[string]struct{ expr, cast string }{
	"code":    {"w.code", "text"},
	"name":    {"w.name", "text"},
	"status":  {"w.active", "boolean"},
	"created": {"w.created_at", "timestamptz"},
}

const defaultSort = "name"

// warehouseCursor es la posición de la última fila entregada. Lleva el orden
// con el que se generó para rechazar un cursor viejo si el cliente cambió de orden.
type warehouseCursor struct {
	Order string `json:"o"`
	Value string `json:"v"`
	ID    int64  `json:"id"`
}

func (f Filter) sort() string {
	if _, ok := warehouseSorts[f.Sort]; ok {
		return f.Sort
	}

	return defaultSort
}

func sortValue(w Warehouse, sort string) string {
	switch sort {
	case "code":
		return w.Code
	case "status":
		return strconv.FormatBool(w.Active)
	case "created":
		return w.CreatedAt.UTC().Format(time.RFC3339Nano)
	default:
		return w.Name
	}
}

// escapeLike evita que un % o _ escrito por el usuario actúe como comodín.
func escapeLike(text string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(text)
}

// List devuelve una página de MÁXIMO 20 almacenes, ordenada por cursor.
func (s *Store) List(ctx context.Context, f Filter) (pagination.Page[Warehouse], error) {
	var (
		args  []any
		where = []string{"w.deleted_at IS NULL"}
	)

	arg := func(value any) string {
		args = append(args, value)

		return "$" + strconv.Itoa(len(args))
	}

	if f.Search != "" {
		n := arg(escapeLike(f.Search))
		where = append(where, fmt.Sprintf(
			`(f_unaccent(lower(w.name)) LIKE '%%' || f_unaccent(lower(%[1]s)) || '%%' ESCAPE '\'`+
				` OR lower(w.code) LIKE '%%' || lower(%[1]s) || '%%' ESCAPE '\')`, n))
	}

	if f.BranchID != nil {
		where = append(where, "w.branch_id = "+arg(*f.BranchID))
	}

	if f.Active != nil {
		where = append(where, "w.active = "+arg(*f.Active))
	}

	sort := f.sort()
	spec := warehouseSorts[sort]
	direction, comparison := "ASC", ">"

	if f.Desc {
		direction, comparison = "DESC", "<"
	}

	order := sort + ":" + direction

	var cursor warehouseCursor

	hasCursor, err := pagination.Decode(f.Cursor, &cursor)
	if err != nil || (hasCursor && cursor.Order != order) {
		return pagination.Page[Warehouse]{}, invalidField("cursor", "El cursor no es válido.")
	}

	if hasCursor {
		where = append(where, "("+spec.expr+", w.id) "+comparison+
			" ("+arg(cursor.Value)+"::"+spec.cast+", "+arg(cursor.ID)+")")
	}

	query := warehouseSelect +
		" WHERE " + strings.Join(where, " AND ") +
		" ORDER BY " + spec.expr + " " + direction + ", w.id " + direction +
		" LIMIT " + arg(pagination.Limit())

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return pagination.Page[Warehouse]{}, err
	}
	defer rows.Close()

	warehouses := make([]Warehouse, 0, pagination.Limit())

	for rows.Next() {
		w, err := scanWarehouse(rows)
		if err != nil {
			return pagination.Page[Warehouse]{}, err
		}

		warehouses = append(warehouses, w)
	}

	if err := rows.Err(); err != nil {
		return pagination.Page[Warehouse]{}, err
	}

	return pagination.Build(warehouses, func(last Warehouse) any {
		return warehouseCursor{Order: order, Value: sortValue(last, sort), ID: last.ID}
	})
}
