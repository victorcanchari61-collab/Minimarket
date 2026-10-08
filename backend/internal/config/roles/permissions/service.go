package permissions

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"minimarket/backend/internal/platform/database"
)

// Service concentra las reglas de los accesos. No conoce HTTP. Lo que cambia
// varias tablas corre en una transacción. (Las solicitudes, en service_requests.go.)
type Service struct {
	pool  *pgxpool.Pool
	store *Store
	rules Rules
}

func NewService(pool *pgxpool.Pool, store *Store, rules Rules) *Service {
	return &Service{pool: pool, store: store, rules: rules}
}

// checkCodes valida contra el catálogo los permisos que llegan y los deja
// sin repetir y en orden. "*" no se puede dar: es solo del rol Administrador.
func (s *Service) checkCodes(field string, codes []string) ([]string, error) {
	var unknown []string

	for _, code := range codes {
		switch {
		case code == "*":
			return nil, invalidField(field, "El acceso total es solo del rol Administrador.")
		case !s.rules.Valid(code):
			unknown = append(unknown, code)
		}
	}

	if len(unknown) > 0 {
		return nil, invalidField(field, fmt.Sprintf("Permisos que no existen: %s.", strings.Join(unknown, ", ")))
	}

	out := slices.Clone(codes)
	slices.Sort(out)

	return slices.Compact(out), nil
}

func mapStoreError(err error, notFound func() error) error {
	if errors.Is(err, errNotFound) {
		return notFound()
	}

	return err
}

// --- por rol ----------------------------------------------------------------

func (s *Service) Roles(ctx context.Context) ([]RoleAccess, error) {
	return s.store.Roles(ctx)
}

// SetRolePermissions cambia lo que da un rol. Surte efecto de inmediato: los
// permisos se leen en cada petición.
func (s *Service) SetRolePermissions(ctx context.Context, id int64, permissions []string) error {
	permissions, err := s.checkCodes("permissions", permissions)
	if err != nil {
		return err
	}

	return database.InTx(ctx, s.pool, func(tx pgx.Tx) error {
		store := NewStore(tx)

		code, err := store.RoleCode(ctx, id)
		if err != nil {
			return mapStoreError(err, func() error { return roleNotFound() })
		}

		if code == AdminCode {
			return protectedRole()
		}

		return store.SetRolePermissions(ctx, id, permissions)
	})
}

// --- por persona ------------------------------------------------------------

func (s *Service) Persons(ctx context.Context, search string) ([]Person, error) {
	return s.store.Persons(ctx, strings.TrimSpace(search))
}

func (s *Service) Person(ctx context.Context, id int64) (PersonAccess, error) {
	person, err := s.store.Person(ctx, id)
	if err != nil {
		return PersonAccess{}, mapStoreError(err, func() error { return userNotFound() })
	}

	roles, rolePermissions, err := s.store.PersonRoles(ctx, id)
	if err != nil {
		return PersonAccess{}, err
	}

	allow, deny, err := s.store.DirectPermissions(ctx, id)
	if err != nil {
		return PersonAccess{}, err
	}

	return PersonAccess{
		Person: person, Roles: roles, RolePermissions: rolePermissions, Allow: allow, Deny: deny,
	}, nil
}

// SetPersonAccess cambia los permisos directos (los que se le dan) y las
// denegaciones (los que se le quitan) de una persona. `actorID` es quien lo
// hace: nadie cambia sus propios permisos, y a un administrador no se le toca.
func (s *Service) SetPersonAccess(ctx context.Context, actorID, id int64, allow, deny []string) (PersonAccess, error) {
	allow, err := s.checkCodes("allow", allow)
	if err != nil {
		return PersonAccess{}, err
	}

	deny, err = s.checkCodes("deny", deny)
	if err != nil {
		return PersonAccess{}, err
	}

	for _, code := range allow {
		if slices.Contains(deny, code) {
			return PersonAccess{}, invalidField("deny", fmt.Sprintf("%s no puede estar permitido y denegado a la vez.", code))
		}
	}

	person, err := s.store.Person(ctx, id)
	if err != nil {
		return PersonAccess{}, mapStoreError(err, func() error { return userNotFound() })
	}

	switch {
	case id == actorID:
		return PersonAccess{}, ownAccess()
	case person.IsAdmin:
		return PersonAccess{}, administratorHasEverything()
	}

	if err := s.store.SetDirectPermissions(ctx, id, allow, deny); err != nil {
		return PersonAccess{}, err
	}

	return s.Person(ctx, id)
}
