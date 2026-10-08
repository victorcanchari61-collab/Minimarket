package list

import (
	"context"
	"errors"
	"regexp"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"minimarket/backend/internal/pagination"
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
	case errors.Is(err, errUnknownBranch):
		return invalidField("branch_ids", "Alguna de las sucursales no existe.")
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

func (s *Service) Branches(ctx context.Context) ([]BranchRef, error) {
	return s.store.Branches(ctx)
}

// applyBranchRule decide a qué sucursales entra el usuario: un administrador
// trabaja en toda la cadena; quien no lo es, o tiene "todas" o al menos una.
func applyBranchRule(ctx context.Context, store *Store, in Input) (Input, error) {
	isAdmin, err := store.IncludesAdminRole(ctx, in.RoleIDs)
	if err != nil {
		return in, err
	}

	slices.Sort(in.BranchIDs)
	in.BranchIDs = slices.Compact(in.BranchIDs)

	switch {
	case isAdmin || in.AllBranches:
		in.AllBranches, in.BranchIDs = true, nil
	case len(in.BranchIDs) == 0:
		return in, invalidField("branch_ids", "Elige al menos una sucursal o marca todas.")
	}

	return in, nil
}

func (s *Service) Summary(ctx context.Context) (Summary, error) {
	return s.store.Summary(ctx)
}
