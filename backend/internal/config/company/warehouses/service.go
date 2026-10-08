package warehouses

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"minimarket/backend/internal/pagination"
)

var codeFormat = regexp.MustCompile(`^[A-Z0-9][A-Z0-9-]{0,14}$`)

// Service concentra las reglas de los almacenes. No conoce HTTP.
type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

// normalize limpia la entrada y aplica las reglas que no expresa el JSON.
func normalize(in Input) (Input, error) {
	in.Code = strings.ToUpper(strings.TrimSpace(in.Code))
	in.Name = strings.TrimSpace(in.Name)
	in.Address = strings.TrimSpace(in.Address)

	switch {
	case in.BranchID <= 0:
		return in, invalidField("branch_id", "Elige la sucursal.")
	case in.Code == "":
		return in, invalidField("code", "Escribe el código del almacén.")
	case !codeFormat.MatchString(in.Code):
		return in, invalidField("code", "El código usa letras, números y guiones (hasta 15 caracteres).")
	case in.Name == "":
		return in, invalidField("name", "Escribe el nombre del almacén.")
	}

	return in, nil
}

// mapStoreError traduce los errores del store a errores de negocio.
func mapStoreError(err error) error {
	switch {
	case errors.Is(err, errDuplicateCode):
		return codeTaken()
	case errors.Is(err, errUnknownBranch):
		return invalidField("branch_id", "La sucursal no existe.")
	case errors.Is(err, errNotFound):
		return warehouseNotFound()
	default:
		return err
	}
}

// checkBranch exige que la sucursal exista y no esté eliminada.
func (s *Service) checkBranch(ctx context.Context, id int64) error {
	exists, err := s.store.BranchExists(ctx, id)
	if err != nil {
		return err
	}

	if !exists {
		return invalidField("branch_id", "La sucursal no existe.")
	}

	return nil
}

func (s *Service) Get(ctx context.Context, id int64) (Warehouse, error) {
	warehouse, err := s.store.Get(ctx, id)

	return warehouse, mapStoreError(err)
}

func (s *Service) List(ctx context.Context, f Filter) (pagination.Page[Warehouse], error) {
	return s.store.List(ctx, f)
}

func (s *Service) Branches(ctx context.Context) ([]BranchRef, error) {
	return s.store.Branches(ctx)
}

func (s *Service) Summary(ctx context.Context) (Summary, error) {
	return s.store.Summary(ctx)
}

func (s *Service) Create(ctx context.Context, in Input) (Warehouse, error) {
	in, err := normalize(in)
	if err != nil {
		return Warehouse{}, err
	}

	if err := s.checkBranch(ctx, in.BranchID); err != nil {
		return Warehouse{}, err
	}

	id, err := s.store.Insert(ctx, in)
	if err != nil {
		return Warehouse{}, mapStoreError(err)
	}

	return s.Get(ctx, id)
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Warehouse, error) {
	in, err := normalize(in)
	if err != nil {
		return Warehouse{}, err
	}

	if err := s.checkBranch(ctx, in.BranchID); err != nil {
		return Warehouse{}, err
	}

	if err := s.store.Update(ctx, id, in); err != nil {
		return Warehouse{}, mapStoreError(err)
	}

	return s.Get(ctx, id)
}

// Delete marca el almacén como eliminado. (Cuando exista el stock, un almacén
// con existencias no se podrá eliminar: se vaciará o se desactivará.)
func (s *Service) Delete(ctx context.Context, id int64) error {
	return mapStoreError(s.store.SoftDelete(ctx, id))
}
