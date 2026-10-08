package roles

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"minimarket/backend/internal/pagination"
	"minimarket/backend/internal/platform/database"
)

// Service concentra las reglas de los roles. No conoce HTTP. Crear o editar un
// rol cambia dos tablas, así que corre en una transacción.
type Service struct {
	pool  *pgxpool.Pool
	store *Store
	// valid dice si un código existe en el catálogo de permisos. Se recibe de
	// quien arma el submódulo para no depender del paquete de permisos.
	valid func(code string) bool
}

func NewService(pool *pgxpool.Pool, store *Store, valid func(code string) bool) *Service {
	return &Service{pool: pool, store: store, valid: valid}
}

// normalize limpia la entrada y valida los permisos contra el catálogo.
func (s *Service) normalize(in Input) (Input, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Description = strings.TrimSpace(in.Description)

	if in.Name == "" {
		return in, invalidField("name", "Escribe el nombre del rol.")
	}

	var unknown []string

	for _, code := range in.Permissions {
		switch {
		case code == "*":
			return in, invalidField("permissions", "Solo el rol Administrador tiene acceso total.")
		case !s.valid(code):
			unknown = append(unknown, code)
		}
	}

	if len(unknown) > 0 {
		return in, invalidField("permissions", fmt.Sprintf("Permisos que no existen: %s.", strings.Join(unknown, ", ")))
	}

	slices.Sort(in.Permissions)
	in.Permissions = slices.Compact(in.Permissions)

	return in, nil
}

// mapStoreError traduce los errores del store a errores de negocio.
func mapStoreError(err error) error {
	switch {
	case errors.Is(err, errDuplicateName):
		return nameTaken()
	case errors.Is(err, errNotFound):
		return roleNotFound()
	default:
		return err
	}
}

func (s *Service) Get(ctx context.Context, id int64) (Role, error) {
	role, err := s.store.Get(ctx, id)

	return role, mapStoreError(err)
}

func (s *Service) List(ctx context.Context, f Filter) (pagination.Page[Role], error) {
	return s.store.List(ctx, f)
}

func (s *Service) Create(ctx context.Context, in Input) (Role, error) {
	in, err := s.normalize(in)
	if err != nil {
		return Role{}, err
	}

	var id int64

	err = database.InTx(ctx, s.pool, func(tx pgx.Tx) error {
		store := NewStore(tx)

		var err error

		if id, err = store.Insert(ctx, in); err != nil {
			return mapStoreError(err)
		}

		return store.SetPermissions(ctx, id, in.Permissions)
	})
	if err != nil {
		return Role{}, err
	}

	return s.Get(ctx, id)
}

// Update cambia el nombre, la descripción y los permisos. Surte efecto de
// inmediato: los permisos se leen en cada petición.
func (s *Service) Update(ctx context.Context, id int64, in Input) (Role, error) {
	in, err := s.normalize(in)
	if err != nil {
		return Role{}, err
	}

	err = database.InTx(ctx, s.pool, func(tx pgx.Tx) error {
		store := NewStore(tx)

		current, err := store.Get(ctx, id)
		if err != nil {
			return mapStoreError(err)
		}

		if current.Code == AdminCode {
			return protectedRole()
		}

		if err := store.Update(ctx, id, in); err != nil {
			return mapStoreError(err)
		}

		return store.SetPermissions(ctx, id, in.Permissions)
	})
	if err != nil {
		return Role{}, err
	}

	return s.Get(ctx, id)
}

// Delete elimina un rol que ningún usuario tiene.
func (s *Service) Delete(ctx context.Context, id int64) error {
	return database.InTx(ctx, s.pool, func(tx pgx.Tx) error {
		store := NewStore(tx)

		current, err := store.Get(ctx, id)
		if err != nil {
			return mapStoreError(err)
		}

		switch {
		case current.Code == AdminCode:
			return protectedRole()
		case current.UserCount > 0:
			return roleInUse(current.UserCount)
		}

		if err := store.Delete(ctx, id); err != nil {
			if errors.Is(err, errInUse) {
				return roleInUse(current.UserCount)
			}

			return mapStoreError(err)
		}

		return nil
	})
}
