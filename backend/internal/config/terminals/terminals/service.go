package terminals

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"minimarket/backend/internal/pagination"
)

var codeFormat = regexp.MustCompile(`^[A-Z0-9][A-Z0-9-]{0,14}$`)

// Service concentra las reglas de las terminales. No conoce HTTP.
type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

// mapStoreError traduce los errores del store a errores de negocio.
func mapStoreError(err error) error {
	switch {
	case errors.Is(err, errDuplicateCode):
		return codeTaken()
	case errors.Is(err, errNotFound):
		return terminalNotFound()
	default:
		return err
	}
}

// check limpia la entrada y aplica las reglas que no expresa el JSON: la caja
// va en una tienda (no en un centro de distribución) y su almacén es de esa tienda.
func (s *Service) check(ctx context.Context, in Input) (Input, error) {
	in.Code = strings.ToUpper(strings.TrimSpace(in.Code))
	in.Name = strings.TrimSpace(in.Name)

	switch {
	case in.BranchID <= 0:
		return in, invalidField("branch_id", "Elige la sucursal.")
	case in.Code == "":
		return in, invalidField("code", "Escribe el código de la terminal.")
	case !codeFormat.MatchString(in.Code):
		return in, invalidField("code", "El código usa letras, números y guiones (hasta 15 caracteres).")
	case in.Name == "":
		return in, invalidField("name", "Escribe el nombre de la terminal.")
	}

	isStore, err := s.store.BranchIsStore(ctx, in.BranchID)
	if err != nil {
		return in, err
	}

	if !isStore {
		return in, invalidField("branch_id", "Elige una tienda: un centro de distribución no vende, así que no lleva cajas.")
	}

	if in.WarehouseID != nil {
		inBranch, err := s.store.WarehouseInBranch(ctx, *in.WarehouseID, in.BranchID)
		if err != nil {
			return in, err
		}

		if !inBranch {
			return in, invalidField("warehouse_id", "El almacén tiene que ser de la misma sucursal.")
		}
	}

	return in, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Terminal, error) {
	terminal, err := s.store.Get(ctx, id)

	return terminal, mapStoreError(err)
}

func (s *Service) List(ctx context.Context, f Filter) (pagination.Page[Terminal], error) {
	return s.store.List(ctx, f)
}

func (s *Service) Branches(ctx context.Context) ([]BranchRef, error) {
	return s.store.Branches(ctx)
}

func (s *Service) Warehouses(ctx context.Context) ([]WarehouseRef, error) {
	return s.store.Warehouses(ctx)
}

func (s *Service) Summary(ctx context.Context) (Summary, error) {
	return s.store.Summary(ctx)
}

func (s *Service) Create(ctx context.Context, in Input) (Terminal, error) {
	in, err := s.check(ctx, in)
	if err != nil {
		return Terminal{}, err
	}

	id, err := s.store.Insert(ctx, in)
	if err != nil {
		return Terminal{}, mapStoreError(err)
	}

	return s.Get(ctx, id)
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Terminal, error) {
	in, err := s.check(ctx, in)
	if err != nil {
		return Terminal{}, err
	}

	if err := s.store.Update(ctx, id, in); err != nil {
		return Terminal{}, mapStoreError(err)
	}

	return s.Get(ctx, id)
}

// Delete elimina una terminal sin series asignadas. Si solo se quiere dejar de
// usar, se desactiva.
func (s *Service) Delete(ctx context.Context, id int64) error {
	terminal, err := s.store.Get(ctx, id)
	if err != nil {
		return mapStoreError(err)
	}

	if terminal.Series > 0 {
		return terminalInUse(terminal.Series)
	}

	return mapStoreError(s.store.SoftDelete(ctx, id))
}
