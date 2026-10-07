package units

import (
	"context"

	"minimarket/backend/internal/platform/database"
)

// Store es el único que escribe SQL en este paquete.
type Store struct {
	db database.Executor
}

func NewStore(db database.Executor) *Store {
	return &Store{db: db}
}

func (s *Store) List(ctx context.Context) ([]Unit, error) {
	rows, err := s.db.Query(ctx, `SELECT id, name, abbreviation FROM units ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Unit{}

	for rows.Next() {
		var u Unit
		if err := rows.Scan(&u.ID, &u.Name, &u.Abbreviation); err != nil {
			return nil, err
		}

		out = append(out, u)
	}

	return out, rows.Err()
}
