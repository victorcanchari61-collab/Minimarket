package permissions

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"minimarket/backend/internal/pagination"
	"minimarket/backend/internal/platform/database"
)

// RequestAccess crea una solicitud de acceso a una acción concreta ("qué
// pantalla quiero abrir"). La puede hacer cualquier persona con sesión.
func (s *Service) RequestAccess(ctx context.Context, userID int64, permission, reason string) (Request, error) {
	permission = strings.TrimSpace(permission)
	reason = strings.TrimSpace(reason)

	if !s.rules.IsAction(permission) || !s.rules.Valid(permission) {
		return Request{}, invalidField("permission", "Esa pantalla o acción no existe.")
	}

	allowed, err := s.rules.Allows(ctx, userID, permission)
	if err != nil {
		return Request{}, err
	}

	if allowed {
		return Request{}, alreadyAllowed()
	}

	id, err := s.store.InsertRequest(ctx, userID, permission, reason)
	if errors.Is(err, errDuplicatePending) {
		return Request{}, pendingExists()
	}

	if err != nil {
		return Request{}, err
	}

	return s.Request(ctx, id)
}

func (s *Service) Request(ctx context.Context, id int64) (Request, error) {
	request, err := s.store.GetRequest(ctx, id)

	return request, mapStoreError(err, func() error { return requestNotFound() })
}

func (s *Service) Requests(ctx context.Context, status RequestStatus, cursor string) (pagination.Page[Request], error) {
	if status != "" && !status.Valid() {
		return pagination.Page[Request]{}, invalidField("status", "El estado no es válido.")
	}

	return s.store.ListRequests(ctx, status, cursor)
}

func (s *Service) PendingRequests(ctx context.Context) (int64, error) {
	return s.store.PendingCount(ctx)
}

// Approve aprueba una solicitud pendiente: la persona recibe el permiso
// directo (si tenía una denegación de lo mismo, se retira).
func (s *Service) Approve(ctx context.Context, actorID, id int64) (Request, error) {
	err := database.InTx(ctx, s.pool, func(tx pgx.Tx) error {
		store := NewStore(tx)

		request, err := store.GetRequest(ctx, id)
		if err != nil {
			return mapStoreError(err, func() error { return requestNotFound() })
		}

		if err := store.Decide(ctx, id, RequestApproved, actorID, ""); err != nil {
			return decideError(err)
		}

		return store.GrantAllow(ctx, request.UserID, request.Permission)
	})
	if err != nil {
		return Request{}, err
	}

	return s.Request(ctx, id)
}

// Reject rechaza una solicitud pendiente, con una nota opcional.
func (s *Service) Reject(ctx context.Context, actorID, id int64, note string) (Request, error) {
	if _, err := s.store.GetRequest(ctx, id); err != nil {
		return Request{}, mapStoreError(err, func() error { return requestNotFound() })
	}

	if err := s.store.Decide(ctx, id, RequestRejected, actorID, strings.TrimSpace(note)); err != nil {
		return Request{}, decideError(err)
	}

	return s.Request(ctx, id)
}

func decideError(err error) error {
	if errors.Is(err, errNotPending) {
		return alreadyDecided()
	}

	return err
}
