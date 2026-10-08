package history

import (
	"context"
	"strconv"
	"strings"
	"time"

	"minimarket/backend/internal/pagination"
	"minimarket/backend/internal/platform/database"
)

type Store struct {
	db database.Executor
}

func NewStore(db database.Executor) *Store {
	return &Store{db: db}
}

// actionCursor es la posición de la última línea entregada: el historial se
// ordena por (fecha, id), igual que el índice audit_log_at_idx.
type actionCursor struct {
	Order string `json:"o"`
	At    string `json:"at"`
	ID    int64  `json:"id"`
}

func escapeLike(text string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(text)
}

// List devuelve una página de MÁXIMO 20 líneas del historial.
func (s *Store) List(ctx context.Context, f Filter) (pagination.Page[Action], error) {
	var args []any

	arg := func(value any) string {
		args = append(args, value)

		return "$" + strconv.Itoa(len(args))
	}

	where := []string{"a.at >= " + arg(f.From), "a.at < " + arg(f.To)}

	if f.UserID != nil {
		where = append(where, "a.user_id = "+arg(*f.UserID))
	}

	if f.Entity != "" {
		where = append(where, "a.entity = "+arg(f.Entity))
	}

	if f.Action != "" {
		where = append(where, "a.action = "+arg(f.Action))
	}

	if f.Search != "" {
		n := arg(escapeLike(f.Search))
		where = append(where, `(f_unaccent(lower(a.label)) LIKE '%' || f_unaccent(lower(`+n+`)) || '%' ESCAPE '\'`+
			` OR f_unaccent(lower(a.user_name)) LIKE '%' || f_unaccent(lower(`+n+`)) || '%' ESCAPE '\')`)
	}

	direction, comparison := "ASC", ">"
	if f.Desc {
		direction, comparison = "DESC", "<"
	}

	order := "at:" + direction

	var cursor actionCursor

	hasCursor, err := pagination.Decode(f.Cursor, &cursor)
	if err != nil || (hasCursor && cursor.Order != order) {
		return pagination.Page[Action]{}, invalidField("cursor", "El cursor no es válido.")
	}

	if hasCursor {
		where = append(where, "(a.at, a.id) "+comparison+" ("+arg(cursor.At)+"::timestamptz, "+arg(cursor.ID)+")")
	}

	query := `
		SELECT a.id, a.at, a.user_id, a.user_name, a.user_email, a.action, a.entity, a.entity_id, a.label, a.method, a.ip
		FROM audit_log a
		WHERE ` + strings.Join(where, " AND ") +
		" ORDER BY a.at " + direction + ", a.id " + direction +
		" LIMIT " + arg(pagination.Limit())

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return pagination.Page[Action]{}, err
	}
	defer rows.Close()

	actions := make([]Action, 0, pagination.Limit())

	for rows.Next() {
		var a Action
		if err := rows.Scan(&a.ID, &a.At, &a.UserID, &a.UserName, &a.UserEmail, &a.Action,
			&a.Entity, &a.EntityID, &a.Label, &a.Method, &a.IP); err != nil {
			return pagination.Page[Action]{}, err
		}

		actions = append(actions, a)
	}

	if err := rows.Err(); err != nil {
		return pagination.Page[Action]{}, err
	}

	return pagination.Build(actions, func(last Action) any {
		return actionCursor{Order: order, At: last.At.UTC().Format(time.RFC3339Nano), ID: last.ID}
	})
}

// Users son las personas que alguna vez hicieron algo, para el filtro de «quién».
func (s *Store) Users(ctx context.Context) ([]UserRef, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, name, email FROM users
		WHERE deleted_at IS NULL AND EXISTS (SELECT 1 FROM audit_log a WHERE a.user_id = users.id)
		ORDER BY name, id LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []UserRef{}

	for rows.Next() {
		var u UserRef
		if err := rows.Scan(&u.ID, &u.Name, &u.Email); err != nil {
			return nil, err
		}

		out = append(out, u)
	}

	return out, rows.Err()
}
