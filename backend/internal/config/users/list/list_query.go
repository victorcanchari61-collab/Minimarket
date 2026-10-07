package list

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
var userSorts = map[string]struct{ expr, cast string }{
	"name":    {"u.name", "text"},
	"email":   {"u.email", "text"},
	"status":  {"u.active", "boolean"},
	"created": {"u.created_at", "timestamptz"},
}

const defaultSort = "name"

// userCursor es la posición de la última fila entregada. Lleva el orden con el
// que se generó para rechazar un cursor viejo si el cliente cambió de orden.
type userCursor struct {
	Order string `json:"o"`
	Value string `json:"v"`
	ID    int64  `json:"id"`
}

func (f Filter) sort() string {
	if _, ok := userSorts[f.Sort]; ok {
		return f.Sort
	}

	return defaultSort
}

func sortValue(u User, sort string) string {
	switch sort {
	case "email":
		return u.Email
	case "status":
		return strconv.FormatBool(u.Status == StatusActive)
	case "created":
		return u.CreatedAt.UTC().Format(time.RFC3339Nano)
	default:
		return u.Name
	}
}

// escapeLike evita que un % o _ escrito por el usuario actúe como comodín.
func escapeLike(text string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(text)
}

// List devuelve una página de MÁXIMO 20 usuarios, ordenada por cursor.
func (s *Store) List(ctx context.Context, f Filter) (pagination.Page[User], error) {
	var (
		args  []any
		where = []string{"u.deleted_at IS NULL"}
	)

	arg := func(value any) string {
		args = append(args, value)

		return "$" + strconv.Itoa(len(args))
	}

	if f.Search != "" {
		n := arg(escapeLike(f.Search))
		where = append(where, fmt.Sprintf(
			`(f_unaccent(lower(u.name)) LIKE '%%' || f_unaccent(lower(%[1]s)) || '%%' ESCAPE '\'`+
				` OR lower(u.email) LIKE '%%' || lower(%[1]s) || '%%' ESCAPE '\')`, n))
	}

	if f.RoleID != nil {
		where = append(where, "EXISTS (SELECT 1 FROM user_roles fr WHERE fr.user_id = u.id AND fr.role_id = "+
			arg(*f.RoleID)+")")
	}

	if f.Status != "" {
		where = append(where, "u.active = "+arg(f.Status == StatusActive))
	}

	sort := f.sort()
	spec := userSorts[sort]
	direction, comparison := "ASC", ">"

	if f.Desc {
		direction, comparison = "DESC", "<"
	}

	order := sort + ":" + direction

	var cursor userCursor

	hasCursor, err := pagination.Decode(f.Cursor, &cursor)
	if err != nil || (hasCursor && cursor.Order != order) {
		return pagination.Page[User]{}, invalidField("cursor", "El cursor no es válido.")
	}

	if hasCursor {
		where = append(where, "("+spec.expr+", u.id) "+comparison+
			" ("+arg(cursor.Value)+"::"+spec.cast+", "+arg(cursor.ID)+")")
	}

	query := userSelect +
		" WHERE " + strings.Join(where, " AND ") +
		" ORDER BY " + spec.expr + " " + direction + ", u.id " + direction +
		" LIMIT " + arg(pagination.Limit())

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return pagination.Page[User]{}, err
	}
	defer rows.Close()

	users := make([]User, 0, pagination.Limit())

	for rows.Next() {
		user, err := scanUser(rows)
		if err != nil {
			return pagination.Page[User]{}, err
		}

		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return pagination.Page[User]{}, err
	}

	return pagination.Build(users, func(last User) any {
		return userCursor{Order: order, Value: sortValue(last, sort), ID: last.ID}
	})
}
