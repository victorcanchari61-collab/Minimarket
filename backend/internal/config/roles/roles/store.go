package roles

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"minimarket/backend/internal/platform/database"
)

// Store es el único que escribe SQL de escritura en este paquete (el listado
// vive en list_query.go). Funciona igual con el pool o dentro de una transacción.
type Store struct {
	db database.Executor
}

func NewStore(db database.Executor) *Store {
	return &Store{db: db}
}

const roleSelect = `
	SELECT r.id, COALESCE(r.code, ''), r.name, r.description, r.created_at,
	       COALESCE((SELECT array_agg(p.permission ORDER BY p.permission)
	                 FROM role_permissions p WHERE p.role_id = r.id), '{}'::text[]),
	       (SELECT count(*) FROM user_roles ur
	        JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
	        WHERE ur.role_id = r.id)
	FROM roles r`

func scanRole(row pgx.Row) (Role, error) {
	var r Role

	err := row.Scan(&r.ID, &r.Code, &r.Name, &r.Description, &r.CreatedAt, &r.Permissions, &r.UserCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return Role{}, errNotFound
	}

	return r, err
}

// translate convierte las violaciones de restricciones de PostgreSQL en
// errores propios, para que el servicio no conozca nombres de restricciones.
func translate(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return err
	}

	switch {
	case pgErr.Code == "23505" && pgErr.ConstraintName == "roles_name_unique":
		return errDuplicateName
	case pgErr.Code == "23503" && pgErr.ConstraintName == "user_roles_role_id_fkey":
		return errInUse
	default:
		return err
	}
}

func (s *Store) Get(ctx context.Context, id int64) (Role, error) {
	return scanRole(s.db.QueryRow(ctx, roleSelect+` WHERE r.id = $1`, id))
}

func (s *Store) Insert(ctx context.Context, in Input) (int64, error) {
	var id int64

	err := s.db.QueryRow(ctx, `
		INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id`,
		in.Name, in.Description).Scan(&id)

	return id, translate(err)
}

func (s *Store) Update(ctx context.Context, id int64, in Input) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE roles SET name = $2, description = $3, updated_at = now() WHERE id = $1`,
		id, in.Name, in.Description)
	if err != nil {
		return translate(err)
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}

// SetPermissions deja al rol con exactamente estos permisos.
func (s *Store) SetPermissions(ctx context.Context, id int64, permissions []string) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM role_permissions WHERE role_id = $1`, id); err != nil {
		return err
	}

	_, err := s.db.Exec(ctx, `
		INSERT INTO role_permissions (role_id, permission)
		SELECT $1, unnest($2::text[])`, id, permissions)

	return err
}

func (s *Store) Delete(ctx context.Context, id int64) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM roles WHERE id = $1`, id)
	if err != nil {
		return translate(err)
	}

	if tag.RowsAffected() == 0 {
		return errNotFound
	}

	return nil
}
