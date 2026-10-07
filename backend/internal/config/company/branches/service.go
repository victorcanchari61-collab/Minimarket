package branches

import "context"

// Service concentra las reglas de las sucursales. No conoce HTTP.
type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

// List son las sucursales en las que se puede trabajar. (Cuando cada usuario
// tenga sus sucursales asignadas, se filtrará aquí.)
func (s *Service) List(ctx context.Context) ([]Branch, error) {
	return s.store.ListActive(ctx)
}
