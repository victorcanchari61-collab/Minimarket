package permissions

import "github.com/jackc/pgx/v5/pgxpool"

// New arma el submódulo completo (store → servicio → handler). `rules` trae
// lo que se necesita saber del catálogo de permisos, para no depender del
// paquete que lo define.
func New(pool *pgxpool.Pool, rules Rules) *Handler {
	return NewHandler(NewService(pool, NewStore(pool), rules))
}
