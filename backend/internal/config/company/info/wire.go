package info

import "minimarket/backend/internal/platform/database"

// New arma el submódulo completo (store → servicio → handler) sobre una conexión.
func New(db database.Executor) *Handler {
	return NewHandler(NewService(NewStore(db)))
}
