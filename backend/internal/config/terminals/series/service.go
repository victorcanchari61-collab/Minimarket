package series

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"minimarket/backend/internal/pagination"
)

var seriesFormat = regexp.MustCompile(`^[A-Z0-9]{4}$`)

// Service concentra las reglas de las series. No conoce HTTP.
type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

func mapStoreError(err error) error {
	switch {
	case errors.Is(err, errDuplicate):
		return duplicated()
	case errors.Is(err, errNotFound):
		return seriesNotFound()
	default:
		return err
	}
}

// check limpia la entrada y aplica las reglas de SUNAT: cuatro caracteres, con la
// letra que corresponde al tipo; y que la caja sea de la sucursal.
func (s *Service) check(ctx context.Context, in Input) (Input, error) {
	in.Series = strings.ToUpper(strings.TrimSpace(in.Series))

	switch {
	case in.BranchID <= 0:
		return in, invalidField("branch_id", "Elige la sucursal.")
	case !in.Type.Valid():
		return in, invalidField("document_type", "Elige el tipo de comprobante.")
	case !seriesFormat.MatchString(in.Series):
		return in, invalidField("series", "La serie tiene 4 caracteres: letras o números (por ejemplo F001).")
	case !strings.Contains(in.Type.Prefixes(), in.Series[:1]):
		return in, invalidField("series", "Este tipo de comprobante lleva una serie que empieza con "+prefixHint(in.Type)+".")
	}

	exists, err := s.store.BranchExists(ctx, in.BranchID)
	if err != nil {
		return in, err
	}

	if !exists {
		return in, invalidField("branch_id", "La sucursal no existe.")
	}

	if in.TerminalID != nil {
		inBranch, err := s.store.TerminalInBranch(ctx, *in.TerminalID, in.BranchID)
		if err != nil {
			return in, err
		}

		if !inBranch {
			return in, invalidField("terminal_id", "La terminal tiene que ser de la misma sucursal.")
		}
	}

	return in, nil
}

func prefixHint(t DocumentType) string {
	return "«" + strings.Join(strings.Split(t.Prefixes(), ""), "» o «") + "»"
}

func (s *Service) Get(ctx context.Context, id int64) (Series, error) {
	item, err := s.store.Get(ctx, id)

	return item, mapStoreError(err)
}

func (s *Service) List(ctx context.Context, f Filter) (pagination.Page[Series], error) {
	return s.store.List(ctx, f)
}

func (s *Service) Branches(ctx context.Context) ([]BranchRef, error) { return s.store.Branches(ctx) }

func (s *Service) Terminals(ctx context.Context) ([]TerminalRef, error) {
	return s.store.Terminals(ctx)
}

func (s *Service) Summary(ctx context.Context) (Summary, error) { return s.store.Summary(ctx) }

// Create arranca el correlativo en NextNumber (1 si no se indica; otro número
// sirve para continuar una numeración que ya venía de otro sistema).
func (s *Service) Create(ctx context.Context, in Input) (Series, error) {
	in, err := s.check(ctx, in)
	if err != nil {
		return Series{}, err
	}

	if in.NextNumber < 1 {
		in.NextNumber = 1
	}

	id, err := s.store.Insert(ctx, in)
	if err != nil {
		return Series{}, mapStoreError(err)
	}

	return s.Get(ctx, id)
}

// Update cambia la ubicación y el estado. Una serie que ya emitió no cambia de
// tipo, de código ni de sucursal; el correlativo nunca se edita.
func (s *Service) Update(ctx context.Context, id int64, in Input) (Series, error) {
	current, err := s.store.Get(ctx, id)
	if err != nil {
		return Series{}, mapStoreError(err)
	}

	in, err = s.check(ctx, in)
	if err != nil {
		return Series{}, err
	}

	if current.Used() && (in.Type != current.Type || in.Series != current.Series || in.BranchID != current.BranchID) {
		return Series{}, seriesUsed("cambiar su tipo, su código ni su sucursal")
	}

	if err := s.store.Update(ctx, id, in); err != nil {
		return Series{}, mapStoreError(err)
	}

	return s.Get(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	current, err := s.store.Get(ctx, id)
	if err != nil {
		return mapStoreError(err)
	}

	if current.Used() {
		return seriesUsed("eliminar")
	}

	return mapStoreError(s.store.SoftDelete(ctx, id))
}
