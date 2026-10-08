package branches

import "context"

// Service concentra las reglas de las sucursales. No conoce HTTP.
type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

// List son las sucursales en las que puede trabajar el usuario.
func (s *Service) List(ctx context.Context, userID int64) ([]Branch, error) {
	return s.store.ListForUser(ctx, userID)
}
