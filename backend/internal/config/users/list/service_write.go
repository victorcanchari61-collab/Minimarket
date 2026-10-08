package list

import (
	"context"

	"github.com/jackc/pgx/v5"

	"minimarket/backend/internal/auth"
	"minimarket/backend/internal/platform/database"
)

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

		if in, err = applyBranchRule(ctx, store, in); err != nil {
			return err
		}

		if id, err = store.Insert(ctx, in, hash); err != nil {
			return mapStoreError(err)
		}

		if err := store.SetRoles(ctx, id, in.RoleIDs); err != nil {
			return mapStoreError(err)
		}

		return mapStoreError(store.SetBranches(ctx, id, in.BranchIDs))
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

		if in, err = applyBranchRule(ctx, store, in); err != nil {
			return err
		}

		if err := store.Update(ctx, id, in); err != nil {
			return mapStoreError(err)
		}

		if err := store.SetRoles(ctx, id, in.RoleIDs); err != nil {
			return mapStoreError(err)
		}

		if err := store.SetBranches(ctx, id, in.BranchIDs); err != nil {
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
