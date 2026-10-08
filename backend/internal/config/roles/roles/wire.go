package roles

import "github.com/jackc/pgx/v5/pgxpool"

// New arma el submódulo completo (store → servicio → handler). `valid` dice si
// un código de permiso existe; lo entrega quien conoce el catálogo (server),
// para que este paquete no dependa del de permisos.
func New(pool *pgxpool.Pool, valid func(code string) bool) *Handler {
	return NewHandler(NewService(pool, NewStore(pool), valid))
}
