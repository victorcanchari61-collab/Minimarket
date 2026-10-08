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

// ListForUser devuelve las sucursales en uso a las que entra el usuario, por
// nombre: todas si trabaja en toda la cadena, o solo las que se le asignaron.
// Es una lista de consulta (como las unidades): se muestran todas.
func (s *Store) ListForUser(ctx context.Context, userID int64) ([]Branch, error) {
	rows, err := s.db.Query(ctx, `
		SELECT b.id, b.code, b.name, b.address, b.kind
		FROM branches b
		WHERE b.active AND b.deleted_at IS NULL
		  AND (EXISTS (SELECT 1 FROM users u WHERE u.id = $1 AND u.all_branches)
		       OR EXISTS (SELECT 1 FROM user_branches ub WHERE ub.user_id = $1 AND ub.branch_id = b.id))
		ORDER BY b.name, b.id`, userID)
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
