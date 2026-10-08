package roles

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"minimarket/backend/internal/pagination"
)

// Solo estas columnas se pueden ordenar; cada una tiene su índice (columna, id).
var roleSorts = map[string]struct{ expr, cast string }{
	"name":    {"r.name", "text"},
	"created": {"r.created_at", "timestamptz"},
}

const defaultSort = "name"

// roleCursor es la posición de la última fila entregada. Lleva el orden con el
// que se generó para rechazar un cursor viejo si el cliente cambió de orden.
type roleCursor struct {
	Order string `json:"o"`
	Value string `json:"v"`
	ID    int64  `json:"id"`
}

func (f Filter) sort() string {
	if _, ok := roleSorts[f.Sort]; ok {
		return f.Sort
	}

	return defaultSort
}

func sortValue(r Role, sort string) string {
	if sort == "created" {
		return r.CreatedAt.UTC().Format(time.RFC3339Nano)
	}

	return r.Name
}

// escapeLike evita que un % o _ escrito por el usuario actúe como comodín.
func escapeLike(text string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(text)
}

// List devuelve una página de MÁXIMO 20 roles, ordenada por cursor.
func (s *Store) List(ctx context.Context, f Filter) (pagination.Page[Role], error) {
	var (
		args  []any
		where = []string{"TRUE"}
	)

	arg := func(value any) string {
		args = append(args, value)

		return "$" + strconv.Itoa(len(args))
	}

	if f.Search != "" {
		where = append(where, fmt.Sprintf(
			`f_unaccent(lower(r.name)) LIKE '%%' || f_unaccent(lower(%s)) || '%%' ESCAPE '\'`,
			arg(escapeLike(f.Search))))
	}

	sort := f.sort()
	spec := roleSorts[sort]
	direction, comparison := "ASC", ">"

	if f.Desc {
		direction, comparison = "DESC", "<"
	}

	order := sort + ":" + direction

	var cursor roleCursor

	hasCursor, err := pagination.Decode(f.Cursor, &cursor)
	if err != nil || (hasCursor && cursor.Order != order) {
		return pagination.Page[Role]{}, invalidField("cursor", "El cursor no es válido.")
	}

	if hasCursor {
		where = append(where, "("+spec.expr+", r.id) "+comparison+
			" ("+arg(cursor.Value)+"::"+spec.cast+", "+arg(cursor.ID)+")")
	}

	query := roleSelectSQL(!f.SkipPermissions, !f.SkipUserCount) +
		" WHERE " + strings.Join(where, " AND ") +
		" ORDER BY " + spec.expr + " " + direction + ", r.id " + direction +
		" LIMIT " + arg(pagination.Limit())

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return pagination.Page[Role]{}, err
	}
	defer rows.Close()

	roles := make([]Role, 0, pagination.Limit())

	for rows.Next() {
		role, err := scanRole(rows)
		if err != nil {
			return pagination.Page[Role]{}, err
		}

		roles = append(roles, role)
	}

	if err := rows.Err(); err != nil {
		return pagination.Page[Role]{}, err
	}

	return pagination.Build(roles, func(last Role) any {
		return roleCursor{Order: order, Value: sortValue(last, sort), ID: last.ID}
	})
}
