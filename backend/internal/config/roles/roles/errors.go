package roles

import (
	"errors"
	"fmt"

	"minimarket/backend/internal/apperror"
)

// Errores internos del store: el servicio los traduce a errores de negocio.
var (
	errNotFound      = errors.New("roles: no encontrado")
	errDuplicateName = errors.New("roles: nombre repetido")
	errInUse         = errors.New("roles: tiene usuarios")
)

func roleNotFound() *apperror.Error {
	return apperror.New(apperror.NotFound, "El rol no existe.")
}

func nameTaken() *apperror.Error {
	err := apperror.New(apperror.Conflict, "Ya existe un rol con ese nombre.")
	err.Fields = map[string][]string{"name": {err.Message}}

	return err
}

func invalidField(field, message string) *apperror.Error {
	return apperror.ValidationFields(map[string][]string{field: {message}})
}

func protectedRole() *apperror.Error {
	return apperror.New(apperror.Conflict, "El rol Administrador no se puede modificar ni eliminar.")
}

func roleInUse(users int64) *apperror.Error {
	return apperror.New(apperror.Conflict,
		fmt.Sprintf("El rol lo tienen %d usuario(s). Cámbialos a otro rol antes de eliminarlo.", users)).
		WithContext(map[string]any{"user_count": users})
}
