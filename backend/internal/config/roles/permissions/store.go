package permissions

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"minimarket/backend/internal/platform/database"
)

// maxPersons es el tope del buscador de personas: se busca escribiendo, no
// recorriendo una lista, así que no hace falta cursor.
const maxPersons = 20

// Store es el único que escribe SQL en este paquete. Funciona igual con el
// pool o dentro de una transacción. (Las solicitudes están en store_requests.go.)
type Store struct {
	db database.Executor
}

func NewStore(db database.Executor) *Store {
	return &Store{db: db}
}

// --- roles ------------------------------------------------------------------

func (s *Store) Roles(ctx context.Context) ([]RoleAccess, error) {
	rows, err := s.db.Query(ctx, `
		SELECT r.id, r.name, r.description, r.code IS NOT NULL,
		       COALESCE((SELECT array_agg(p.permission ORDER BY p.permission)
		                 FROM role_permissions p WHERE p.role_id = r.id), '{}'::text[]),
		       (SELECT count(*) FROM user_roles ur
		        JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
		        WHERE ur.role_id = r.id)
		FROM roles r ORDER BY r.name, r.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []RoleAccess{}

	for rows.Next() {
		var r RoleAccess
		if err := rows.Scan(&r.ID, &r.Name, &r.Description, &r.IsSystem, &r.Permissions, &r.UserCount); err != nil {
			return nil, err
		}

		out = append(out, r)
	}

	return out, rows.Err()
}

// RoleCode devuelve el código de sistema del rol ("" si es uno común).
func (s *Store) RoleCode(ctx context.Context, id int64) (string, error) {
	var code string

	err := s.db.QueryRow(ctx, `SELECT COALESCE(code, '') FROM roles WHERE id = $1`, id).Scan(&code)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errNotFound
	}

	return code, err
}

// SetRolePermissions deja al rol con exactamente estos permisos.
func (s *Store) SetRolePermissions(ctx context.Context, id int64, permissions []string) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM role_permissions WHERE role_id = $1`, id); err != nil {
		return err
	}

	_, err := s.db.Exec(ctx, `
		INSERT INTO role_permissions (role_id, permission)
		SELECT $1, unnest($2::text[])`, id, permissions)

	return err
}

// --- personas ---------------------------------------------------------------

const personSelect = `
	SELECT u.id, u.code, u.name, u.email, u.active,
	       EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
	               WHERE ur.user_id = u.id AND r.code = 'admin'),
	       COALESCE((SELECT array_agg(r.name ORDER BY r.name, r.id)
	                 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
	                 WHERE ur.user_id = u.id), '{}'::text[])
	FROM users u`

func scanPerson(row pgx.Row) (Person, error) {
	var p Person

	err := row.Scan(&p.ID, &p.Code, &p.Name, &p.Email, &p.Active, &p.IsAdmin, &p.Roles)
	if errors.Is(err, pgx.ErrNoRows) {
		return Person{}, errNotFound
	}

	return p, err
}

// escapeLike evita que un % o _ escrito por el usuario actúe como comodín.
func escapeLike(text string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(text)
}

// Persons busca usuarios por nombre (sin acentos), correo o código. Devuelve
// como máximo 20, por nombre.
func (s *Store) Persons(ctx context.Context, search string) ([]Person, error) {
	var (
		args  []any
		where = "u.deleted_at IS NULL"
	)

	if search != "" {
		args = append(args, escapeLike(search))
		where += ` AND (f_unaccent(lower(u.name)) LIKE '%' || f_unaccent(lower($1)) || '%' ESCAPE '\'` +
			` OR lower(u.email) LIKE '%' || lower($1) || '%' ESCAPE '\'` +
			` OR lower(u.code) LIKE '%' || lower($1) || '%' ESCAPE '\')`
	}

	rows, err := s.db.Query(ctx,
		personSelect+" WHERE "+where+" ORDER BY u.name, u.id LIMIT "+strconv.Itoa(maxPersons), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Person{}

	for rows.Next() {
		p, err := scanPerson(rows)
		if err != nil {
			return nil, err
		}

		out = append(out, p)
	}

	return out, rows.Err()
}

func (s *Store) Person(ctx context.Context, id int64) (Person, error) {
	return scanPerson(s.db.QueryRow(ctx, personSelect+` WHERE u.id = $1 AND u.deleted_at IS NULL`, id))
}

// PersonRoles devuelve los roles de la persona y la unión de lo que dan.
func (s *Store) PersonRoles(ctx context.Context, id int64) ([]RoleRef, []string, error) {
	rows, err := s.db.Query(ctx, `
		SELECT r.id, r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id
		WHERE ur.user_id = $1 ORDER BY r.name, r.id`, id)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	roles := []RoleRef{}

	for rows.Next() {
		var r RoleRef
		if err := rows.Scan(&r.ID, &r.Name); err != nil {
			return nil, nil, err
		}

		roles = append(roles, r)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	var permissions []string

	err = s.db.QueryRow(ctx, `
		SELECT COALESCE(array_agg(DISTINCT rp.permission ORDER BY rp.permission), '{}'::text[])
		FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
		WHERE ur.user_id = $1`, id).Scan(&permissions)

	return roles, permissions, err
}

// DirectPermissions devuelve lo que se le dio y lo que se le quitó a la persona.
func (s *Store) DirectPermissions(ctx context.Context, id int64) (allow, deny []string, err error) {
	rows, err := s.db.Query(ctx, `
		SELECT permission, effect FROM user_permissions WHERE user_id = $1 ORDER BY permission`, id)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	allow, deny = []string{}, []string{}

	for rows.Next() {
		var permission, effect string
		if err := rows.Scan(&permission, &effect); err != nil {
			return nil, nil, err
		}

		if effect == "deny" {
			deny = append(deny, permission)
		} else {
			allow = append(allow, permission)
		}
	}

	return allow, deny, rows.Err()
}

// SetDirectPermissions deja a la persona con exactamente estos permisos
// directos y estas denegaciones.
func (s *Store) SetDirectPermissions(ctx context.Context, id int64, allow, deny []string) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM user_permissions WHERE user_id = $1`, id); err != nil {
		return err
	}

	_, err := s.db.Exec(ctx, `
		INSERT INTO user_permissions (user_id, permission, effect)
		SELECT $1::bigint, unnest($2::text[]), 'allow'
		UNION ALL
		SELECT $1::bigint, unnest($3::text[]), 'deny'`, id, allow, deny)

	return err
}
