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

// Repository es el único que habla SQL en este módulo.
type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

const userColumns = `id, name, email, email_verified_at, password_hash`

func scanUser(row pgx.Row) (User, error) {
	var user User

	err := row.Scan(&user.ID, &user.Name, &user.Email, &user.EmailVerifiedAt, &user.PasswordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}

	return user, err
}

func (r *Repository) FindUserByEmail(ctx context.Context, email string) (User, error) {
	return scanUser(r.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE lower(email) = lower($1)`, email))
}

// EnsureUser crea el usuario si no existe y devuelve el que haya.
func (r *Repository) EnsureUser(ctx context.Context, name, email, passwordHash string) (User, error) {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO users (name, email, email_verified_at, password_hash)
		VALUES ($1, $2, now(), $3)
		ON CONFLICT (lower(email)) DO NOTHING`, name, email, passwordHash)
	if err != nil {
		return User{}, err
	}

	return r.FindUserByEmail(ctx, email)
}

func (r *Repository) CreateToken(
	ctx context.Context, userID int64, name, hash string, expiresAt *time.Time,
) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO api_tokens (user_id, name, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)`, userID, name, hash, expiresAt)

	return err
}

// FindUserByToken devuelve el dueño de un token vigente y el id del token, y
// anota su último uso. Un token vencido o inexistente es ErrNotFound.
func (r *Repository) FindUserByToken(ctx context.Context, hash string) (User, int64, error) {
	var (
		user    User
		tokenID int64
	)

	err := r.pool.QueryRow(ctx, `
		UPDATE api_tokens AS t
		SET last_used_at = now()
		FROM users AS u
		WHERE t.token_hash = $1
		  AND u.id = t.user_id
		  AND (t.expires_at IS NULL OR t.expires_at > now())
		RETURNING t.id, u.id, u.name, u.email, u.email_verified_at, u.password_hash`, hash,
	).Scan(&tokenID, &user.ID, &user.Name, &user.Email, &user.EmailVerifiedAt, &user.PasswordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, 0, ErrNotFound
	}

	return user, tokenID, err
}

func (r *Repository) DeleteToken(ctx context.Context, tokenID int64) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM api_tokens WHERE id = $1`, tokenID)

	return err
}
