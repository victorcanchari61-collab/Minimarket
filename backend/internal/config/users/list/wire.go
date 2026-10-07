package list

import "github.com/jackc/pgx/v5/pgxpool"

// New arma el submódulo completo (store → servicio → handler). Necesita el
// pool, no solo un Executor: crear y editar usuarios abre transacciones.
func New(pool *pgxpool.Pool) *Handler {
	return NewHandler(NewService(pool, NewStore(pool)))
}
