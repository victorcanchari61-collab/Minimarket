package list

import (
	"context"
	"errors"
	"regexp"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"minimarket/backend/internal/auth"
	"minimarket/backend/internal/pagination"
	"minimarket/backend/internal/platform/database"
)

const minPasswordLength = 8

// Formato de cada documento: el DNI son 8 dígitos; el carné y el pasaporte,
// letras y números.
var documentFormat = map[DocumentType]*regexp.Regexp{
	DocumentDNI:      regexp.MustCompile(`^\d{8}$`),
	DocumentCE:       regexp.MustCompile(`^[A-Z0-9]{9,12}$`),
	DocumentPassport: regexp.MustCompile(`^[A-Z0-9]{6,12}$`),
}

var phoneFormat = regexp.MustCompile(`^[0-9+()\-\s]{6,20}$`)

// Service concentra las reglas de los usuarios. No conoce HTTP. Lo que
// cambia varias tablas, o puede dejar al sistema sin administrador, corre en
// una transacción.
type Service struct {
	pool  *pgxpool.Pool
	store *Store
}

func NewService(pool *pgxpool.Pool, store *Store) *Service {
	return &Service{pool: pool, store: store}
}

// normalize limpia la entrada y aplica las reglas que no expresa el JSON.
func normalize(in Input, creating bool) (Input, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.TrimSpace(in.Email)
	in.DocumentNumber = strings.ToUpper(strings.TrimSpace(in.DocumentNumber))
	in.Phone = strings.TrimSpace(in.Phone)
	in.Position = strings.TrimSpace(in.Position)

	if in.Status == "" {
		in.Status = StatusActive
	}

	slices.Sort(in.RoleIDs)
	in.RoleIDs = slices.Compact(in.RoleIDs)

	switch {
	case in.Name == "":
		return in, invalidField("name", "Escribe el nombre.")
	case in.Email == "":
		return in, invalidField("email", "Escribe el correo.")
	case !in.Status.Valid():
		return in, invalidField("status", "El estado no es válido.")
	case creating && len(in.Password) < minPasswordLength:
		return in, invalidField("password", "La contraseña debe tener al menos 8 caracteres.")
	case in.Phone != "" && !phoneFormat.MatchString(in.Phone):
		return in, invalidField("phone", "El teléfono no es válido.")
	}

	return in, checkDocument(in)
}

// checkDocument exige que el tipo y el número vayan juntos y que el número
// tenga el formato de su tipo.
func checkDocument(in Input) error {
	switch {
	case in.DocumentType == "" && in.DocumentNumber == "":
		return nil
	case in.DocumentType == "":
		return invalidField("document_type", "Elige el tipo de documento.")
	case !in.DocumentType.Valid():
		return invalidField("document_type", "El tipo de documento no es válido.")
	case in.DocumentNumber == "":
		return invalidField("document_number", "Escribe el número de documento.")
	case !documentFormat[in.DocumentType].MatchString(in.DocumentNumber):
		return invalidField("document_number", "El número no corresponde al tipo de documento.")
	}

	return nil
}

// mapStoreError traduce los errores del store a errores de negocio.
func mapStoreError(err error) error {
	switch {
	case errors.Is(err, errDuplicateEmail):
		return emailTaken()
	case errors.Is(err, errDuplicateDoc):
		return documentTaken()
	case errors.Is(err, errUnknownRole):
		return invalidField("role_ids", "Alguno de los roles no existe.")
	case errors.Is(err, errNotFound):
		return userNotFound()
	default:
		return err
	}
}

func (s *Service) Get(ctx context.Context, id int64) (User, error) {
	user, err := s.store.Get(ctx, id)

	return user, mapStoreError(err)
}

func (s *Service) List(ctx context.Context, f Filter) (pagination.Page[User], error) {
	if f.Status != "" && !f.Status.Valid() {
		return pagination.Page[User]{}, invalidField("status", "El estado no es válido.")
	}

	return s.store.List(ctx, f)
}

func (s *Service) Roles(ctx context.Context) ([]RoleRef, error) {
	return s.store.Roles(ctx)
}

func (s *Service) Summary(ctx context.Context) (Summary, error) {
	return s.store.Summary(ctx)
}

func (s *Service) Create(ctx context.Context, in Input) (User, error) {
	in, err := normalize(in, true)
	if err != nil {
		return User{}, err
	}

	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		return User{}, err
	}

	var id int64

	err = database.InTx(ctx, s.pool, func(tx pgx.Tx) error {
		store := NewStore(tx)

		var err error

		if id, err = store.Insert(ctx, in, hash); err != nil {
			return mapStoreError(err)
		}

		return mapStoreError(store.SetRoles(ctx, id, in.RoleIDs))
	})
	if err != nil {
		return User{}, err
	}

	return s.Get(ctx, id)
}

// Update cambia los datos, el estado y los roles. `actorID` es quien hace el
// cambio: nadie puede desactivarse a sí mismo, y siempre debe quedar al menos
// un administrador activo.
func (s *Service) Update(ctx context.Context, actorID, id int64, in Input) (User, error) {
	in, err := normalize(in, false)
	if err != nil {
		return User{}, err
	}

	err = database.InTx(ctx, s.pool, func(tx pgx.Tx) error {
		store := NewStore(tx)

		if err := store.LockAdmins(ctx); err != nil {
			return err
		}

		current, err := store.Get(ctx, id)
		if err != nil {
			return mapStoreError(err)
		}

		if id == actorID && in.Status == StatusInactive {
			return yourself("No puedes desactivar tu propio usuario.")
		}

		if err := guardLastAdmin(ctx, store, id, in); err != nil {
			return err
		}

		if err := store.Update(ctx, id, in); err != nil {
			return mapStoreError(err)
		}

		if err := store.SetRoles(ctx, id, in.RoleIDs); err != nil {
			return mapStoreError(err)
		}

		// Desactivar corta sus sesiones abiertas.
		if current.Status == StatusActive && in.Status == StatusInactive {
			return store.RevokeTokens(ctx, id)
		}

		return nil
	})
	if err != nil {
		return User{}, err
	}

	return s.Get(ctx, id)
}

// guardLastAdmin impide que un cambio deje al sistema sin administrador activo.
func guardLastAdmin(ctx context.Context, store *Store, id int64, in Input) error {
	wasAdmin, err := store.IsActiveAdmin(ctx, id)
	if err != nil || !wasAdmin {
		return err
	}

	hasRole, err := store.IncludesAdminRole(ctx, in.RoleIDs)
	if err != nil {
		return err
	}

	if in.Status == StatusActive && hasRole {
		return nil
	}

	others, err := store.OtherActiveAdmins(ctx, id)
	if err != nil {
		return err
	}

	if others == 0 {
		return lastAdministrator()
	}

	return nil
}

func (s *Service) Delete(ctx context.Context, actorID, id int64) error {
	return database.InTx(ctx, s.pool, func(tx pgx.Tx) error {
		store := NewStore(tx)

		if err := store.LockAdmins(ctx); err != nil {
			return err
		}

		if _, err := store.Get(ctx, id); err != nil {
			return mapStoreError(err)
		}

		if id == actorID {
			return yourself("No puedes eliminar tu propio usuario.")
		}

		// Eliminarlo sería quitarle el rol: se valida igual que una edición.
		if err := guardLastAdmin(ctx, store, id, Input{Status: StatusInactive}); err != nil {
			return err
		}

		if err := store.SoftDelete(ctx, id); err != nil {
			return mapStoreError(err)
		}

		return store.RevokeTokens(ctx, id)
	})
}

// ResetPassword cambia la contraseña de otro usuario (o la propia) y cierra
// las sesiones del usuario afectado, salvo que sea quien lo hace.
func (s *Service) ResetPassword(ctx context.Context, actorID, id int64, password string) error {
	if len(password) < minPasswordLength {
		return invalidField("password", "La contraseña debe tener al menos 8 caracteres.")
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}

	return database.InTx(ctx, s.pool, func(tx pgx.Tx) error {
		store := NewStore(tx)

		if err := store.SetPassword(ctx, id, hash); err != nil {
			return mapStoreError(err)
		}

		if id == actorID {
			return nil
		}

		return store.RevokeTokens(ctx, id)
	})
}
