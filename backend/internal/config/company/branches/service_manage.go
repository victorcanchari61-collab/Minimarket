package branches

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"minimarket/backend/internal/pagination"
)

var (
	codeFormat  = regexp.MustCompile(`^[A-Z0-9][A-Z0-9-]{0,9}$`)
	sunatFormat = regexp.MustCompile(`^[0-9]{4}$`)
	phoneFormat = regexp.MustCompile(`^[0-9+()\-\s]{6,20}$`)
)

// normalize limpia la entrada y aplica las reglas que no expresa el JSON.
func normalize(in Input) (Input, error) {
	in.Code = strings.ToUpper(strings.TrimSpace(in.Code))
	in.Name = strings.TrimSpace(in.Name)
	in.Address = strings.TrimSpace(in.Address)
	in.Phone = strings.TrimSpace(in.Phone)
	in.SunatCode = strings.TrimSpace(in.SunatCode)

	if in.Kind == "" {
		in.Kind = KindStore
	}

	switch {
	case in.Code == "":
		return in, invalidField("code", "Escribe el código de la sucursal.")
	case !codeFormat.MatchString(in.Code):
		return in, invalidField("code", "El código usa letras, números y guiones (hasta 10 caracteres).")
	case in.Name == "":
		return in, invalidField("name", "Escribe el nombre de la sucursal.")
	case !in.Kind.Valid():
		return in, invalidField("kind", "El tipo de sucursal no es válido.")
	case in.Phone != "" && !phoneFormat.MatchString(in.Phone):
		return in, invalidField("phone", "El teléfono no es válido.")
	case in.SunatCode != "" && !sunatFormat.MatchString(in.SunatCode):
		return in, invalidField("sunat_code", "El código de establecimiento SUNAT tiene 4 dígitos (ejemplo: 0001).")
	}

	return in, nil
}

// mapStoreError traduce los errores del store a errores de negocio.
func mapStoreError(err error) error {
	switch {
	case errors.Is(err, errDuplicateCode):
		return codeTaken()
	case errors.Is(err, errDuplicateSunat):
		return sunatTaken()
	case errors.Is(err, errNotFound):
		return branchNotFound()
	default:
		return err
	}
}

func (s *Service) Get(ctx context.Context, id int64) (Branch, error) {
	branch, err := s.store.Get(ctx, id)

	return branch, mapStoreError(err)
}

func (s *Service) Page(ctx context.Context, f Filter) (pagination.Page[Branch], error) {
	if f.Kind != "" && !f.Kind.Valid() {
		return pagination.Page[Branch]{}, invalidField("kind", "El tipo de sucursal no es válido.")
	}

	return s.store.List(ctx, f)
}

func (s *Service) Summary(ctx context.Context) (Summary, error) {
	return s.store.Summary(ctx)
}

func (s *Service) Create(ctx context.Context, in Input) (Branch, error) {
	in, err := normalize(in)
	if err != nil {
		return Branch{}, err
	}

	id, err := s.store.Insert(ctx, in)
	if err != nil {
		return Branch{}, mapStoreError(err)
	}

	return s.Get(ctx, id)
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Branch, error) {
	in, err := normalize(in)
	if err != nil {
		return Branch{}, err
	}

	if err := s.store.Update(ctx, id, in); err != nil {
		return Branch{}, mapStoreError(err)
	}

	return s.Get(ctx, id)
}

// Delete elimina una sucursal sin almacenes ni usuarios asignados. Si solo se
// quiere dejar de usar, se desactiva: conserva su historial.
func (s *Service) Delete(ctx context.Context, id int64) error {
	branch, err := s.store.Get(ctx, id)
	if err != nil {
		return mapStoreError(err)
	}

	if branch.Warehouses > 0 || branch.Users > 0 {
		return branchInUse(branch.Users, branch.Warehouses)
	}

	return mapStoreError(s.store.SoftDelete(ctx, id))
}
