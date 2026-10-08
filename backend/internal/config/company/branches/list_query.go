package branches

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
var branchSorts = map[string]struct{ expr, cast string }{
	"code":    {"b.code", "text"},
	"name":    {"b.name", "text"},
	"kind":    {"b.kind", "text"},
	"status":  {"b.active", "boolean"},
	"created": {"b.created_at", "timestamptz"},
}

const defaultSort = "name"

// branchCursor es la posición de la última fila entregada. Lleva el orden con
// el que se generó para rechazar un cursor viejo si el cliente cambió de orden.
type branchCursor struct {
	Order string `json:"o"`
	Value string `json:"v"`
	ID    int64  `json:"id"`
}

func (f Filter) sort() string {
	if _, ok := branchSorts[f.Sort]; ok {
		return f.Sort
	}

	return defaultSort
}

func sortValue(b Branch, sort string) string {
	switch sort {
	case "code":
		return b.Code
	case "kind":
		return string(b.Kind)
	case "status":
		return strconv.FormatBool(b.Active)
	case "created":
		return b.CreatedAt.UTC().Format(time.RFC3339Nano)
	default:
		return b.Name
	}
}

// escapeLike evita que un % o _ escrito por el usuario actúe como comodín.
func escapeLike(text string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(text)
}

// List devuelve una página de MÁXIMO 20 sucursales, ordenada por cursor.
func (s *Store) List(ctx context.Context, f Filter) (pagination.Page[Branch], error) {
	var (
		args  []any
		where = []string{"b.deleted_at IS NULL"}
	)

	arg := func(value any) string {
		args = append(args, value)

		return "$" + strconv.Itoa(len(args))
	}

	if f.Search != "" {
		n := arg(escapeLike(f.Search))
		where = append(where, fmt.Sprintf(
			`(f_unaccent(lower(b.name)) LIKE '%%' || f_unaccent(lower(%[1]s)) || '%%' ESCAPE '\'`+
				` OR lower(b.code) LIKE '%%' || lower(%[1]s) || '%%' ESCAPE '\'`+
				` OR f_unaccent(lower(b.address)) LIKE '%%' || f_unaccent(lower(%[1]s)) || '%%' ESCAPE '\')`, n))
	}

	if f.Kind != "" {
		where = append(where, "b.kind = "+arg(string(f.Kind)))
	}

	if f.Active != nil {
		where = append(where, "b.active = "+arg(*f.Active))
	}

	sort := f.sort()
	spec := branchSorts[sort]
	direction, comparison := "ASC", ">"

	if f.Desc {
		direction, comparison = "DESC", "<"
	}

	order := sort + ":" + direction

	var cursor branchCursor

	hasCursor, err := pagination.Decode(f.Cursor, &cursor)
	if err != nil || (hasCursor && cursor.Order != order) {
		return pagination.Page[Branch]{}, invalidField("cursor", "El cursor no es válido.")
	}

	if hasCursor {
		where = append(where, "("+spec.expr+", b.id) "+comparison+
			" ("+arg(cursor.Value)+"::"+spec.cast+", "+arg(cursor.ID)+")")
	}

	query := branchSelect +
		" WHERE " + strings.Join(where, " AND ") +
		" ORDER BY " + spec.expr + " " + direction + ", b.id " + direction +
		" LIMIT " + arg(pagination.Limit())

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return pagination.Page[Branch]{}, err
	}
	defer rows.Close()

	branches := make([]Branch, 0, pagination.Limit())

	for rows.Next() {
		b, err := scanBranch(rows)
		if err != nil {
			return pagination.Page[Branch]{}, err
		}

		branches = append(branches, b)
	}

	if err := rows.Err(); err != nil {
		return pagination.Page[Branch]{}, err
	}

	return pagination.Build(branches, func(last Branch) any {
		return branchCursor{Order: order, Value: sortValue(last, sort), ID: last.ID}
	})
}
