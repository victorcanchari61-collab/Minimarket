package list

import (
	"errors"

	"minimarket/backend/internal/apperror"
)

// Errores internos del store: el servicio los traduce a errores de negocio.
var (
	errNotFound       = errors.New("users: no encontrado")
	errDuplicateEmail = errors.New("users: correo repetido")
	errUnknownRole    = errors.New("users: rol inexistente")
)

func userNotFound() *apperror.Error {
	return apperror.New(apperror.NotFound, "El usuario no existe.")
}

func emailTaken() *apperror.Error {
	err := apperror.New(apperror.Conflict, "Ya existe un usuario con ese correo.")
	err.Fields = map[string][]string{"email": {err.Message}}

	return err
}

func invalidField(field, message string) *apperror.Error {
	return apperror.ValidationFields(map[string][]string{field: {message}})
}

func lastAdministrator() *apperror.Error {
	return apperror.New(apperror.Conflict, "Debe quedar al menos un administrador activo.")
}

func yourself(message string) *apperror.Error {
	return apperror.New(apperror.Conflict, message)
}
