package series

import (
	"context"
	"strconv"
	"strings"
	"time"

	"minimarket/backend/internal/pagination"
)

// Solo estas columnas se pueden ordenar: cada una tiene su índice (columna, id).
var seriesSorts = map[string]struct{ expr, cast string }{
	"series":  {"s.series", "text"},
	"type":    {"s.document_type", "text"},
	"status":  {"s.active", "boolean"},
	"created": {"s.created_at", "timestamptz"},
}

const defaultSort = "series"

type seriesCursor struct {
	Order string `json:"o"`
	Value string `json:"v"`
	ID    int64  `json:"id"`
}

func (f Filter) sort() string {
	if _, ok := seriesSorts[f.Sort]; ok {
		return f.Sort
	}

	return defaultSort
}

func sortValue(s Series, sort string) string {
	switch sort {
	case "type":
		return string(s.Type)
	case "status":
		return strconv.FormatBool(s.Active)
	case "created":
		return s.CreatedAt.UTC().Format(time.RFC3339Nano)
	default:
		return s.Series
	}
}

func escapeLike(text string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(text)
}

// List devuelve una página de MÁXIMO 20 series, ordenada por cursor.
func (s *Store) List(ctx context.Context, f Filter) (pagination.Page[Series], error) {
	var (
		args  []any
		where = []string{"s.deleted_at IS NULL"}
	)

	arg := func(value any) string {
		args = append(args, value)

		return "$" + strconv.Itoa(len(args))
	}

	if f.Search != "" {
		where = append(where, `s.series LIKE '%' || upper(`+arg(escapeLike(f.Search))+`) || '%' ESCAPE '\'`)
	}

	if f.BranchID != nil {
		where = append(where, "s.branch_id = "+arg(*f.BranchID))
	}

	if f.TerminalID != nil {
		where = append(where, "s.terminal_id = "+arg(*f.TerminalID))
	}

	if f.Type != "" {
		where = append(where, "s.document_type = "+arg(string(f.Type)))
	}

	if f.Active != nil {
		where = append(where, "s.active = "+arg(*f.Active))
	}

	sort := f.sort()
	spec := seriesSorts[sort]
	direction, comparison := "ASC", ">"

	if f.Desc {
		direction, comparison = "DESC", "<"
	}

	order := sort + ":" + direction

	var cursor seriesCursor

	hasCursor, err := pagination.Decode(f.Cursor, &cursor)
	if err != nil || (hasCursor && cursor.Order != order) {
		return pagination.Page[Series]{}, invalidField("cursor", "El cursor no es válido.")
	}

	if hasCursor {
		where = append(where, "("+spec.expr+", s.id) "+comparison+
			" ("+arg(cursor.Value)+"::"+spec.cast+", "+arg(cursor.ID)+")")
	}

	query := seriesSelect +
		" WHERE " + strings.Join(where, " AND ") +
		" ORDER BY " + spec.expr + " " + direction + ", s.id " + direction +
		" LIMIT " + arg(pagination.Limit())

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return pagination.Page[Series]{}, err
	}
	defer rows.Close()

	out := make([]Series, 0, pagination.Limit())

	for rows.Next() {
		item, err := scanSeries(rows)
		if err != nil {
			return pagination.Page[Series]{}, err
		}

		out = append(out, item)
	}

	if err := rows.Err(); err != nil {
		return pagination.Page[Series]{}, err
	}

	return pagination.Build(out, func(last Series) any {
		return seriesCursor{Order: order, Value: sortValue(last, sort), ID: last.ID}
	})
}
