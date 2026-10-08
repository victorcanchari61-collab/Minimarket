package info

import (
	"context"
	"errors"
	"regexp"
	"strings"
)

var (
	emailFormat = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	phoneFormat = regexp.MustCompile(`^[0-9+()\-\s]{6,20}$`)
)

// Service concentra las reglas de los datos de la empresa. No conoce HTTP.
type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

// validRUC comprueba un RUC peruano: 11 dígitos, que empiece por un tipo
// válido (10 persona natural, 15-17 otros, 20 persona jurídica) y cuyo último
// dígito coincida con el verificador (módulo 11).
func validRUC(ruc string) bool {
	if len(ruc) != 11 {
		return false
	}

	for _, r := range ruc {
		if r < '0' || r > '9' {
			return false
		}
	}

	switch ruc[:2] {
	case "10", "15", "16", "17", "20":
	default:
		return false
	}

	weights := [10]int{5, 4, 3, 2, 7, 6, 5, 4, 3, 2}
	sum := 0

	for i, w := range weights {
		sum += int(ruc[i]-'0') * w
	}

	check := 11 - sum%11

	switch check {
	case 10:
		check = 0
	case 11:
		check = 1
	}

	return int(ruc[10]-'0') == check
}

// normalize limpia la entrada y aplica las reglas que no expresa el JSON.
func normalize(in Input) (Input, error) {
	in.RUC = strings.TrimSpace(in.RUC)
	in.LegalName = strings.TrimSpace(in.LegalName)
	in.TradeName = strings.TrimSpace(in.TradeName)
	in.FiscalAddress = strings.TrimSpace(in.FiscalAddress)
	in.Phone = strings.TrimSpace(in.Phone)
	in.Email = strings.TrimSpace(in.Email)

	switch {
	case in.LegalName == "":
		return in, invalidField("legal_name", "Escribe la razón social.")
	case in.RUC != "" && !validRUC(in.RUC):
		return in, invalidField("ruc", "El RUC no es válido: revisa sus 11 dígitos.")
	case in.Phone != "" && !phoneFormat.MatchString(in.Phone):
		return in, invalidField("phone", "El teléfono no es válido.")
	case in.Email != "" && !emailFormat.MatchString(in.Email):
		return in, invalidField("email", "El correo no es válido.")
	}

	return in, nil
}

func mapStoreError(err error) error {
	switch {
	case errors.Is(err, errNotFound):
		return companyNotFound()
	case errors.Is(err, errDuplicateRUC):
		return rucTaken()
	default:
		return err
	}
}

func (s *Service) Get(ctx context.Context) (Company, error) {
	company, err := s.store.Get(ctx)

	return company, mapStoreError(err)
}

func (s *Service) Update(ctx context.Context, in Input) (Company, error) {
	in, err := normalize(in)
	if err != nil {
		return Company{}, err
	}

	current, err := s.store.Get(ctx)
	if err != nil {
		return Company{}, mapStoreError(err)
	}

	if err := s.store.Update(ctx, current.ID, in); err != nil {
		return Company{}, mapStoreError(err)
	}

	return s.Get(ctx)
}
