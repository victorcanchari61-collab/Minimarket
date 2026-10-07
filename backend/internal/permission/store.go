package permission

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// AdminRole es el código del rol que tiene todo y al que no se le aplican
// denegaciones.
const AdminRole = "admin"

const (
	effectAllow = "allow"
	effectDeny  = "deny"
)

// Store es el único que habla SQL en este paquete. (Crear y editar roles es de
// Configuraciones › Roles y permisos; aquí solo se lee lo que un usuario puede.)
type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Grants reúne lo que le dan sus roles, lo que se le dio a él directamente y
// lo que se le quitó.
func (s *Store) Grants(ctx context.Context, userID int64) (Grants, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT rp.permission, 'allow'
		FROM user_roles ur
		JOIN role_permissions rp ON rp.role_id = ur.role_id
		WHERE ur.user_id = $1
		UNION
		SELECT permission, effect FROM user_permissions WHERE user_id = $1`, userID)
	if err != nil {
		return Grants{}, err
	}

	defer rows.Close()

	var grants Grants

	for rows.Next() {
		var permission, effect string
		if err := rows.Scan(&permission, &effect); err != nil {
			return Grants{}, err
		}

		if effect == effectDeny {
			grants.Deny = append(grants.Deny, permission)
		} else {
			grants.Allow = append(grants.Allow, permission)
		}
	}

	if err := rows.Err(); err != nil {
		return Grants{}, err
	}

	err = s.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
			WHERE ur.user_id = $1 AND r.code = $2)`, userID, AdminRole).Scan(&grants.Superuser)

	return grants, err
}

// AssignAdmin le da a un usuario el rol Administrador (si ya lo tiene, no hace nada).
func (s *Store) AssignAdmin(ctx context.Context, userID int64) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO user_roles (user_id, role_id)
		SELECT $1, id FROM roles WHERE code = $2
		ON CONFLICT DO NOTHING`, userID, AdminRole)

	return err
}
