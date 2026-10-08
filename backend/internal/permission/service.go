package permission

import "context"

// Service responde "¿qué puede hacer este usuario?". No conoce HTTP.
type Service struct {
	catalog *Catalog
	store   *Store
}

func NewService(catalog *Catalog, store *Store) *Service {
	return &Service{catalog: catalog, store: store}
}

func (s *Service) Catalog() *Catalog { return s.catalog }

// Valid dice si un código de permiso existe en el catálogo ("*" incluido).
func (s *Service) Valid(code string) bool { return s.catalog.Valid(code) }

// Can dice si el usuario puede hacer esa acción, según lo que tiene hoy.
func (s *Service) Can(ctx context.Context, userID int64, code string) (bool, error) {
	grants, err := s.store.Grants(ctx, userID)
	if err != nil {
		return false, err
	}

	return s.catalog.Allows(grants, code), nil
}

// Grants son los permisos de un usuario, tal como están hoy en la base.
func (s *Service) Grants(ctx context.Context, userID int64) (Grants, error) {
	return s.store.Grants(ctx, userID)
}

// Allows dice si los permisos dados alcanzan para alguna de las acciones.
func (s *Service) Allows(grants Grants, codes ...string) bool {
	for _, code := range codes {
		if s.catalog.Allows(grants, code) {
			return true
		}
	}

	return false
}

// Me son las acciones que el usuario puede hacer: lo que usa el frontend para
// mostrar u ocultar menús y botones.
func (s *Service) Me(ctx context.Context, userID int64) (Grants, []string, error) {
	grants, err := s.store.Grants(ctx, userID)
	if err != nil {
		return Grants{}, nil, err
	}

	return grants, s.catalog.Effective(grants), nil
}

// AssignAdmin deja a un usuario como Administrador (el usuario de prueba y
// quien monta el sistema).
func (s *Service) AssignAdmin(ctx context.Context, userID int64) error {
	return s.store.AssignAdmin(ctx, userID)
}
