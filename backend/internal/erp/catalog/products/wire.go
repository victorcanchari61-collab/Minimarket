package products

import "minimarket/backend/internal/platform/database"

// New arma el submódulo completo (store → servicio → handler) sobre una
// conexión. Es lo único que necesita saber quien lo monta (internal/server).
func New(db database.Executor) *Handler {
	return NewHandler(NewService(NewStore(db)))
}
