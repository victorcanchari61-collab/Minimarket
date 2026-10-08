package history

import (
	"context"
	"time"

	"minimarket/backend/internal/pagination"
)

const (
	// Sin fechas se muestra el último mes: el historial crece sin parar y
	// nadie necesita años de golpe.
	defaultDays = 30
	// Un rango más largo que esto se pide por partes (y, a futuro, se exporta).
	maxDays = 366
)

// limaZone: las fechas del filtro son días de Perú (UTC-5, sin horario de verano).
var limaZone = time.FixedZone("America/Lima", -5*60*60)

// Service concentra las reglas de la consulta. No conoce HTTP.
type Service struct {
	store *Store
	now   func() time.Time
}

func NewService(store *Store) *Service {
	return &Service{store: store, now: time.Now}
}

// Range convierte los días del filtro («desde» y «hasta», ambos incluidos) en un
// intervalo [From, To). Sin «hasta» llega hasta hoy; sin «desde», 30 días atrás.
func (s *Service) Range(from, to *time.Time) (time.Time, time.Time, error) {
	today := dayStart(s.now())

	end := today.AddDate(0, 0, 1)
	if to != nil {
		end = dayStart(*to).AddDate(0, 0, 1)
	}

	start := end.AddDate(0, 0, -defaultDays)
	if from != nil {
		start = dayStart(*from)
	}

	switch {
	case !start.Before(end):
		return start, end, invalidField("to", "La fecha final no puede ser anterior a la inicial.")
	case end.Sub(start) > maxDays*24*time.Hour:
		return start, end, invalidField("from", "El rango puede abarcar como máximo un año.")
	}

	return start, end, nil
}

// dayStart es la medianoche (hora de Perú) del día en que cae t.
func dayStart(t time.Time) time.Time {
	local := t.In(limaZone)

	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, limaZone)
}

func (s *Service) List(ctx context.Context, f Filter) (pagination.Page[Action], error) {
	return s.store.List(ctx, f)
}

func (s *Service) Users(ctx context.Context) ([]UserRef, error) {
	return s.store.Users(ctx)
}
