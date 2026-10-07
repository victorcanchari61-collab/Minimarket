package permission

import "github.com/jackc/pgx/v5/pgxpool"

// New arma el servicio de permisos con el catálogo de la suite.
func New(pool *pgxpool.Pool) *Service {
	return NewService(DefaultCatalog(), NewStore(pool))
}
