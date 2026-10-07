package list

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"minimarket/backend/internal/platform/database"
)

// adminLock serializa los cambios que pueden dejar al sistema sin
// administrador: dos peticiones a la vez no pueden quitar al último cada una.
const adminLock = 746200

// Store es el único que escribe SQL de escritura en este paquete (el listado
// vive en list_query.go). Funciona igual con el pool o dentro de una transacción.
type Store struct {
	db database.Executor
}

func NewStore(db database.Executor) *Store {
	return &Store{db: db}
}

// El código 'admin' es el del rol Administrador (ver la migración de permisos).
const userSelect = `
	SELECT u.id, u.code, u.name, u.email, u.active, u.created_at, u.last_login_at,
	       COALESCE(u.document_type, ''), COALESCE(u.document_number, ''),
	       COALESCE(u.phone, ''), COALESCE(u.position, ''),
	       COALESCE((SELECT array_agg(r.id ORDER BY r.name, r.id)
	                 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
	                 WHERE ur.user_id = u.id), '{}'::bigint[]),
	       COALESCE((SELECT array_agg(r.name ORDER BY r.name, r.id)
	                 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
	                 WHERE ur.user_id = u.id), '{}'::text[])
	FROM users u`

func scanUser(row pgx.Row) (User, error) {
	var (
		u        User
		active   bool
		docType  string
		roleIDs  []int64
		roleName []string
	)

	err := row.Scan(&u.ID, &u.Code, &u.Name, &u.Email, &active, &u.CreatedAt, &u.LastLoginAt,
		&docType, &u.DocumentNumber, &u.Phone, &u.Position, &roleIDs, &roleName)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, errNotFound
	}

	if err != nil {
		return User{}, err
	}

	u.DocumentType = DocumentType(docType)
	u.Status = StatusInactive
	if active {
		u.Status = StatusActive
	}

	u.Roles = make([]RoleRef, len(roleIDs))
	for i, id := range roleIDs {
		u.Roles[i] = RoleRef{ID: id, Name: roleName[i]}
	}

	return u, nil
}

// translate convierte las violaciones de restricciones de PostgreSQL en
// errores propios, para que el servicio no conozca nombres de restricciones.
func translate(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return err
	}

	switch {
	case pgErr.Code == "23505" && pgErr.ConstraintName == "users_email_unique":
		return errDuplicateEmail
	case pgErr.Code == "23505" && pgErr.ConstraintName == "users_document_unique":
		return errDuplicateDoc
	case pgErr.Code == "23503" && pgErr.ConstraintName == "user_roles_role_id_fkey":
		return errUnknownRole
	default:
		return err
	}
}

func (s *Store) Get(ctx context.Context, id int64) (User, error) {
	return scanUser(s.db.QueryRow(ctx, userSelect+` WHERE u.id = $1 AND u.deleted_at IS NULL`, id))
}

// Insert crea el usuario; su código lo genera la base de datos.
func (s *Store) Insert(ctx context.Context, in Input, passwordHash string) (int64, error) {
	var id int64

	err := s.db.QueryRow(ctx, `
		INSERT INTO users (name, email, email_verified_at, password_hash, active,
		                   document_type, document_number, phone, position)
		VALUES ($1, $2, now(), $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''))
		RETURNING id`,
		in.Name, in.Email, passwordHash, in.Status == StatusActive,
		string(in.DocumentType), in.DocumentNumber, in.Phone, in.Position,
	).Scan(&id)

	return id, translate(err)
}

func (s *Store) Update(ctx context.Context, id int64, in Input) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE users
		SET name = $2, email = $3, active = $4,
		    document_type = NULLIF($5, ''), document_number = NULLIF($6, ''),
		    phone = NULLIF($7, ''), position = NULLIF($8, ''), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id, in.Name, in.Email, in.Status == StatusActive,
		string(in.DocumentType), in.DocumentNumber, in.Phone, in.Position)
	if err != nil {
		return translate(err)
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

// SetRoles deja al usuario con exactamente estos roles.
func (s *Store) SetRoles(ctx context.Context, id int64, roleIDs []int64) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1`, id); err != nil {
		return err
	}

	_, err := s.db.Exec(ctx, `
		INSERT INTO user_roles (user_id, role_id)
		SELECT $1, unnest($2::bigint[])`, id, roleIDs)

	return translate(err)
}

// SoftDelete marca el usuario como eliminado: desaparece de los listados y
// libera su correo.
func (s *Store) SoftDelete(ctx context.Context, id int64) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE users SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

func (s *Store) SetPassword(ctx context.Context, id int64, passwordHash string) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE users SET password_hash = $2, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`, id, passwordHash)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

// RevokeTokens cierra todas las sesiones del usuario.
func (s *Store) RevokeTokens(ctx context.Context, id int64) error {
	_, err := s.db.Exec(ctx, `DELETE FROM api_tokens WHERE user_id = $1`, id)

	return err
}

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
	rows, err := s.db.Query(ctx, `SELECT id, name FROM roles ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []RoleRef{}

	for rows.Next() {
		var r RoleRef
		if err := rows.Scan(&r.ID, &r.Name); err != nil {
			return nil, err
		}

		out = append(out, r)
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
