package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound indica que la consulta no encontró fila.
var ErrNotFound = errors.New("no encontrado")

// Store es el único que habla SQL en este paquete.
type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

const userColumns = `id, name, email, email_verified_at, password_hash, active`

func scanUser(row pgx.Row) (User, error) {
	var user User

	err := row.Scan(&user.ID, &user.Name, &user.Email, &user.EmailVerifiedAt, &user.PasswordHash, &user.Active)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}

	return user, err
}

func (s *Store) FindUserByEmail(ctx context.Context, email string) (User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL`, email))
}

// EnsureUser crea el usuario si no existe y devuelve el que haya.
func (s *Store) EnsureUser(ctx context.Context, name, email, passwordHash string) (User, error) {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO users (name, email, email_verified_at, password_hash)
		VALUES ($1, $2, now(), $3)
		ON CONFLICT (lower(email)) WHERE deleted_at IS NULL DO NOTHING`, name, email, passwordHash)
	if err != nil {
		return User{}, err
	}

	return s.FindUserByEmail(ctx, email)
}

func (s *Store) CreateToken(
	ctx context.Context, userID int64, name, hash string, expiresAt *time.Time,
) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO api_tokens (user_id, name, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)`, userID, name, hash, expiresAt)

	return err
}

// FindUserByToken devuelve el dueño de un token vigente y el id del token, y
// anota su último uso. Un token vencido o inexistente es ErrNotFound.
func (s *Store) FindUserByToken(ctx context.Context, hash string) (User, int64, error) {
	var (
		user    User
		tokenID int64
	)

	err := s.pool.QueryRow(ctx, `
		UPDATE api_tokens AS t
		SET last_used_at = now()
		FROM users AS u
		WHERE t.token_hash = $1
		  AND u.id = t.user_id
		  AND u.active AND u.deleted_at IS NULL
		  AND (t.expires_at IS NULL OR t.expires_at > now())
		RETURNING t.id, u.id, u.name, u.email, u.email_verified_at, u.password_hash, u.active`, hash,
	).Scan(&tokenID, &user.ID, &user.Name, &user.Email, &user.EmailVerifiedAt, &user.PasswordHash, &user.Active)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, 0, ErrNotFound
	}

	return user, tokenID, err
}

func (s *Store) DeleteToken(ctx context.Context, tokenID int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM api_tokens WHERE id = $1`, tokenID)

	return err
}
