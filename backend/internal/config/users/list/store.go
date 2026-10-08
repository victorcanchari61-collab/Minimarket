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
const userHead = `
	SELECT u.id, u.code, u.name, u.email, u.active, u.created_at, u.last_login_at,
	       COALESCE(u.document_type, ''), COALESCE(u.document_number, ''),
	       COALESCE(u.phone, ''), COALESCE(u.position, ''), u.all_branches,`

const userBranches = `
	       COALESCE((SELECT array_agg(b.id ORDER BY b.name, b.id)
	                 FROM user_branches ub JOIN branches b ON b.id = ub.branch_id
	                 WHERE ub.user_id = u.id), '{}'::bigint[]),
	       COALESCE((SELECT array_agg(b.name ORDER BY b.name, b.id)
	                 FROM user_branches ub JOIN branches b ON b.id = ub.branch_id
	                 WHERE ub.user_id = u.id), '{}'::text[]),`

const userRoles = `
	       COALESCE((SELECT array_agg(r.id ORDER BY r.name, r.id)
	                 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
	                 WHERE ur.user_id = u.id), '{}'::bigint[]),
	       COALESCE((SELECT array_agg(r.name ORDER BY r.name, r.id)
	                 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
	                 WHERE ur.user_id = u.id), '{}'::text[])`

// Las mismas columnas, pero con listas vacías en lugar de las subconsultas que
// no se pidieron: el listado solo calcula lo que la tabla muestra.
const (
	noUserBranches = `
	       '{}'::bigint[], '{}'::text[],`
	noUserRoles = `
	       '{}'::bigint[], '{}'::text[]`
)

// userSelectSQL arma el SELECT con o sin los roles y las sucursales de cada usuario.
func userSelectSQL(roles, branches bool) string {
	sql := userHead

	if branches {
		sql += userBranches
	} else {
		sql += noUserBranches
	}

	if roles {
		sql += userRoles
	} else {
		sql += noUserRoles
	}

	return sql + "\n\tFROM users u"
}

// userSelect trae todo: para un solo usuario.
var userSelect = userSelectSQL(true, true)

func scanUser(row pgx.Row) (User, error) {
	var (
		u        User
		active   bool
		docType  string
		roleIDs  []int64
		roleName []string
		brIDs    []int64
		brNames  []string
	)

	err := row.Scan(&u.ID, &u.Code, &u.Name, &u.Email, &active, &u.CreatedAt, &u.LastLoginAt,
		&docType, &u.DocumentNumber, &u.Phone, &u.Position, &u.AllBranches, &brIDs, &brNames,
		&roleIDs, &roleName)
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

	u.Branches = make([]BranchRef, len(brIDs))
	for i, id := range brIDs {
		u.Branches[i] = BranchRef{ID: id, Name: brNames[i]}
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
	case pgErr.Code == "23503" && pgErr.ConstraintName == "user_branches_branch_id_fkey":
		return errUnknownBranch
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
		                   document_type, document_number, phone, position, all_branches)
		VALUES ($1, $2, now(), $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''), $9)
		RETURNING id`,
		in.Name, in.Email, passwordHash, in.Status == StatusActive,
		string(in.DocumentType), in.DocumentNumber, in.Phone, in.Position, in.AllBranches,
	).Scan(&id)

	return id, translate(err)
}

func (s *Store) Update(ctx context.Context, id int64, in Input) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE users
		SET name = $2, email = $3, active = $4,
		    document_type = NULLIF($5, ''), document_number = NULLIF($6, ''),
		    phone = NULLIF($7, ''), position = NULLIF($8, ''), all_branches = $9, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id, in.Name, in.Email, in.Status == StatusActive,
		string(in.DocumentType), in.DocumentNumber, in.Phone, in.Position, in.AllBranches)
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

// SetBranches deja al usuario con exactamente estas sucursales.
func (s *Store) SetBranches(ctx context.Context, id int64, branchIDs []int64) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM user_branches WHERE user_id = $1`, id); err != nil {
		return err
	}

	_, err := s.db.Exec(ctx, `
		INSERT INTO user_branches (user_id, branch_id)
		SELECT $1, unnest($2::bigint[])`, id, branchIDs)

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
