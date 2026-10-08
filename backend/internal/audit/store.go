package audit

import (
	"context"

	"minimarket/backend/internal/platform/database"
)

type Store struct {
	db database.Executor
}

func NewStore(db database.Executor) *Store {
	return &Store{db: db}
}

func (s *Store) Insert(ctx context.Context, e Entry) error {
	var (
		userID *int64
		name   string
		email  = e.Email
	)

	if e.Actor != nil {
		userID, name, email = &e.Actor.ID, e.Actor.Name, e.Actor.Email
	}

	_, err := s.db.Exec(ctx, `
		INSERT INTO audit_log (user_id, user_name, user_email, action, entity, entity_id, label, method, path, status, ip)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		userID, name, email, e.Action, e.Entity, e.EntityID, e.Label, e.Method, e.Path, e.Status, e.IP)

	return err
}
