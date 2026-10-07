package units

import "context"

// Service concentra las reglas de las unidades. No conoce HTTP.
type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

func (s *Service) List(ctx context.Context) ([]Unit, error) {
	return s.store.List(ctx)
}
