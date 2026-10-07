package branches

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

// ListActive devuelve las sucursales en uso, por nombre. Es una lista de
// consulta (como las unidades): una cadena tiene pocas y se muestran todas.
func (s *Store) ListActive(ctx context.Context) ([]Branch, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, code, name, address, kind
		FROM branches
		WHERE active
		ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Branch{}

	for rows.Next() {
		var b Branch
		if err := rows.Scan(&b.ID, &b.Code, &b.Name, &b.Address, &b.Kind); err != nil {
			return nil, err
		}

		out = append(out, b)
	}

	return out, rows.Err()
}
