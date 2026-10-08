package permissions

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"minimarket/backend/internal/pagination"
)

const requestSelect = `
	SELECT q.id, q.user_id, u.code, u.name, u.email, q.permission, q.reason, q.status,
	       COALESCE(d.name, ''), q.decided_at, q.decision_note, q.created_at
	FROM access_requests q
	JOIN users u ON u.id = q.user_id
	LEFT JOIN users d ON d.id = q.decided_by`

func scanRequest(row pgx.Row) (Request, error) {
	var (
		q      Request
		status string
	)

	err := row.Scan(&q.ID, &q.UserID, &q.UserCode, &q.UserName, &q.UserEmail, &q.Permission, &q.Reason,
		&status, &q.DecidedByName, &q.DecidedAt, &q.DecisionNote, &q.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Request{}, errNotFound
	}

	q.Status = RequestStatus(status)

	return q, err
}

func (s *Store) GetRequest(ctx context.Context, id int64) (Request, error) {
	return scanRequest(s.db.QueryRow(ctx, requestSelect+` WHERE q.id = $1`, id))
}

func (s *Store) InsertRequest(ctx context.Context, userID int64, permission, reason string) (int64, error) {
	var id int64

	err := s.db.QueryRow(ctx, `
		INSERT INTO access_requests (user_id, permission, reason) VALUES ($1, $2, $3) RETURNING id`,
		userID, permission, reason).Scan(&id)

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "access_requests_pending_unique" {
		return 0, errDuplicatePending
	}

	return id, err
}

// Decide resuelve una solicitud pendiente. Si ya estaba resuelta no cambia nada.
func (s *Store) Decide(ctx context.Context, id int64, status RequestStatus, decidedBy int64, note string) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE access_requests
		SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4
		WHERE id = $1 AND status = 'pending'`, id, string(status), decidedBy, note)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return errNotPending
	}

	return nil
}

// GrantAllow le da a la persona el permiso directo (y quita una denegación
// anterior del mismo permiso).
func (s *Store) GrantAllow(ctx context.Context, userID int64, permission string) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO user_permissions (user_id, permission, effect) VALUES ($1, $2, 'allow')
		ON CONFLICT (user_id, permission) DO UPDATE SET effect = 'allow'`, userID, permission)

	return err
}

func (s *Store) PendingCount(ctx context.Context) (int64, error) {
	var n int64

	err := s.db.QueryRow(ctx, `SELECT count(*) FROM access_requests WHERE status = 'pending'`).Scan(&n)

	return n, err
}

// requestCursor es la posición de la última solicitud entregada.
type requestCursor struct {
	Value string `json:"v"`
	ID    int64  `json:"id"`
}

// ListRequests devuelve una página de MÁXIMO 20 solicitudes, de la más
// reciente a la más antigua, por cursor. `status` vacío = todas.
func (s *Store) ListRequests(ctx context.Context, status RequestStatus, cursorToken string) (pagination.Page[Request], error) {
	var (
		args  []any
		where = []string{"TRUE"}
	)

	arg := func(value any) string {
		args = append(args, value)

		return "$" + strconv.Itoa(len(args))
	}

	if status != "" {
		where = append(where, "q.status = "+arg(string(status)))
	}

	var cursor requestCursor

	hasCursor, err := pagination.Decode(cursorToken, &cursor)
	if err != nil {
		return pagination.Page[Request]{}, invalidField("cursor", "El cursor no es válido.")
	}

	if hasCursor {
		where = append(where, "(q.created_at, q.id) < ("+arg(cursor.Value)+"::timestamptz, "+arg(cursor.ID)+")")
	}

	rows, err := s.db.Query(ctx, requestSelect+
		" WHERE "+strings.Join(where, " AND ")+
		" ORDER BY q.created_at DESC, q.id DESC LIMIT "+arg(pagination.Limit()), args...)
	if err != nil {
		return pagination.Page[Request]{}, err
	}
	defer rows.Close()

	requests := make([]Request, 0, pagination.Limit())

	for rows.Next() {
		q, err := scanRequest(rows)
		if err != nil {
			return pagination.Page[Request]{}, err
		}

		requests = append(requests, q)
	}

	if err := rows.Err(); err != nil {
		return pagination.Page[Request]{}, err
	}

	return pagination.Build(requests, func(last Request) any {
		return requestCursor{Value: last.CreatedAt.UTC().Format(time.RFC3339Nano), ID: last.ID}
	})
}
