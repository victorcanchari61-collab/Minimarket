package terminals

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
var terminalSorts = map[string]struct{ expr, cast string }{
	"code":    {"t.code", "text"},
	"name":    {"t.name", "text"},
	"status":  {"t.active", "boolean"},
	"created": {"t.created_at", "timestamptz"},
}

const defaultSort = "name"

// terminalCursor es la posición de la última fila entregada. Lleva el orden
// con el que se generó para rechazar un cursor viejo si el cliente cambió de orden.
type terminalCursor struct {
	Order string `json:"o"`
	Value string `json:"v"`
	ID    int64  `json:"id"`
}

func (f Filter) sort() string {
	if _, ok := terminalSorts[f.Sort]; ok {
		return f.Sort
	}

	return defaultSort
}

func sortValue(t Terminal, sort string) string {
	switch sort {
	case "code":
		return t.Code
	case "status":
		return strconv.FormatBool(t.Active)
	case "created":
		return t.CreatedAt.UTC().Format(time.RFC3339Nano)
	default:
		return t.Name
	}
}

// escapeLike evita que un % o _ escrito por el usuario actúe como comodín.
func escapeLike(text string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(text)
}

// List devuelve una página de MÁXIMO 20 terminales, ordenada por cursor.
func (s *Store) List(ctx context.Context, f Filter) (pagination.Page[Terminal], error) {
	var (
		args  []any
		where = []string{"t.deleted_at IS NULL"}
	)

	arg := func(value any) string {
		args = append(args, value)

		return "$" + strconv.Itoa(len(args))
	}

	if f.Search != "" {
		n := arg(escapeLike(f.Search))
		where = append(where, fmt.Sprintf(
			`(f_unaccent(lower(t.name)) LIKE '%%' || f_unaccent(lower(%[1]s)) || '%%' ESCAPE '\'`+
				` OR lower(t.code) LIKE '%%' || lower(%[1]s) || '%%' ESCAPE '\')`, n))
	}

	if f.BranchID != nil {
		where = append(where, "t.branch_id = "+arg(*f.BranchID))
	}

	if f.Active != nil {
		where = append(where, "t.active = "+arg(*f.Active))
	}

	sort := f.sort()
	spec := terminalSorts[sort]
	direction, comparison := "ASC", ">"

	if f.Desc {
		direction, comparison = "DESC", "<"
	}

	order := sort + ":" + direction

	var cursor terminalCursor

	hasCursor, err := pagination.Decode(f.Cursor, &cursor)
	if err != nil || (hasCursor && cursor.Order != order) {
		return pagination.Page[Terminal]{}, invalidField("cursor", "El cursor no es válido.")
	}

	if hasCursor {
		where = append(where, "("+spec.expr+", t.id) "+comparison+
			" ("+arg(cursor.Value)+"::"+spec.cast+", "+arg(cursor.ID)+")")
	}

	query := terminalSelectSQL(!f.SkipSeries) +
		" WHERE " + strings.Join(where, " AND ") +
		" ORDER BY " + spec.expr + " " + direction + ", t.id " + direction +
		" LIMIT " + arg(pagination.Limit())

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return pagination.Page[Terminal]{}, err
	}
	defer rows.Close()

	terminals := make([]Terminal, 0, pagination.Limit())

	for rows.Next() {
		t, err := scanTerminal(rows)
		if err != nil {
			return pagination.Page[Terminal]{}, err
		}

		terminals = append(terminals, t)
	}

	if err := rows.Err(); err != nil {
		return pagination.Page[Terminal]{}, err
	}

	return pagination.Build(terminals, func(last Terminal) any {
		return terminalCursor{Order: order, Value: sortValue(last, sort), ID: last.ID}
	})
}
