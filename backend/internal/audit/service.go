package audit

import (
	"context"
	"strings"
	"unicode/utf8"
)

const (
	maxLabel = 200
	maxPath  = 300
	maxEmail = 255
)

// Service registra las acciones. No conoce HTTP.
type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

// Record guarda una línea del historial, recortando lo que venga largo para que
// una entrada rara nunca impida guardar el resto.
func (s *Service) Record(ctx context.Context, e Entry) error {
	e.Label = cut(strings.TrimSpace(e.Label), maxLabel)
	e.Path = cut(e.Path, maxPath)
	e.Email = cut(strings.TrimSpace(e.Email), maxEmail)

	return s.store.Insert(ctx, e)
}

func cut(text string, max int) string {
	if utf8.RuneCountInString(text) <= max {
		return text
	}

	return string([]rune(text)[:max])
}
