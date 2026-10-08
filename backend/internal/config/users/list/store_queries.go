package list

import "context"

// --- administradores --------------------------------------------------------

func (s *Store) LockAdmins(ctx context.Context) error {
	_, err := s.db.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, adminLock)

	return err
}

// IsActiveAdmin dice si el usuario es hoy un administrador que puede entrar.
func (s *Store) IsActiveAdmin(ctx context.Context, id int64) (bool, error) {
	var is bool

	err := s.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM users u
			JOIN user_roles ur ON ur.user_id = u.id
			JOIN roles r ON r.id = ur.role_id
			WHERE u.id = $1 AND u.active AND u.deleted_at IS NULL AND r.code = 'admin')`, id).Scan(&is)

	return is, err
}

// OtherActiveAdmins cuenta los administradores activos que no son este usuario.
func (s *Store) OtherActiveAdmins(ctx context.Context, id int64) (int64, error) {
	var n int64

	err := s.db.QueryRow(ctx, `
		SELECT count(DISTINCT u.id) FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.id <> $1 AND u.active AND u.deleted_at IS NULL AND r.code = 'admin'`, id).Scan(&n)

	return n, err
}

// IncludesAdminRole dice si entre estos roles está el de Administrador.
func (s *Store) IncludesAdminRole(ctx context.Context, roleIDs []int64) (bool, error) {
	var is bool

	err := s.db.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM roles WHERE code = 'admin' AND id = ANY($1::bigint[]))`,
		roleIDs).Scan(&is)

	return is, err
}

// --- consultas para la pantalla ---------------------------------------------

func (s *Store) Roles(ctx context.Context) ([]RoleRef, error) {
	rows, err := s.db.Query(ctx, `SELECT id, name, COALESCE(code = 'admin', FALSE) FROM roles ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []RoleRef{}

	for rows.Next() {
		var r RoleRef
		if err := rows.Scan(&r.ID, &r.Name, &r.IsAdmin); err != nil {
			return nil, err
		}

		out = append(out, r)
	}

	return out, rows.Err()
}

// Branches son las sucursales activas que se pueden asignar a un usuario.
func (s *Store) Branches(ctx context.Context) ([]BranchRef, error) {
	rows, err := s.db.Query(ctx, `SELECT id, name, kind FROM branches WHERE active ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []BranchRef{}

	for rows.Next() {
		var b BranchRef
		if err := rows.Scan(&b.ID, &b.Name, &b.Kind); err != nil {
			return nil, err
		}

		out = append(out, b)
	}

	return out, rows.Err()
}

func (s *Store) Summary(ctx context.Context) (Summary, error) {
	var sum Summary

	err := s.db.QueryRow(ctx, `
		SELECT count(*) FILTER (WHERE u.active),
		       count(*) FILTER (WHERE NOT u.active),
		       count(*) FILTER (WHERE u.active AND EXISTS (
		           SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
		           WHERE ur.user_id = u.id AND r.code = 'admin')),
		       count(*) FILTER (WHERE NOT EXISTS (
		           SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id))
		FROM users u WHERE u.deleted_at IS NULL`,
	).Scan(&sum.Active, &sum.Inactive, &sum.Administrators, &sum.WithoutRoles)

	return sum, err
}
