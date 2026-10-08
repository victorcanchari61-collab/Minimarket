package permissions

import (
	"errors"

	"minimarket/backend/internal/apperror"
)

// Errores internos del store: el servicio los traduce a errores de negocio.
var (
	errNotFound         = errors.New("permissions: no encontrado")
	errDuplicatePending = errors.New("permissions: ya hay una solicitud pendiente")
	errNotPending       = errors.New("permissions: la solicitud ya fue resuelta")
)

func invalidField(field, message string) *apperror.Error {
	return apperror.ValidationFields(map[string][]string{field: {message}})
}

func roleNotFound() *apperror.Error {
	return apperror.New(apperror.NotFound, "El rol no existe.")
}

func userNotFound() *apperror.Error {
	return apperror.New(apperror.NotFound, "El usuario no existe.")
}

func requestNotFound() *apperror.Error {
	return apperror.New(apperror.NotFound, "La solicitud no existe.")
}

func protectedRole() *apperror.Error {
	return apperror.New(apperror.Conflict, "El rol Administrador no se puede modificar.")
}

func administratorHasEverything() *apperror.Error {
	return apperror.New(apperror.Conflict, "Un administrador ya tiene acceso total: no se le puede restringir ni ampliar.")
}

func ownAccess() *apperror.Error {
	return apperror.New(apperror.Conflict, "No puedes cambiar tus propios permisos: pídeselo a otro administrador.")
}

func alreadyAllowed() *apperror.Error {
	return apperror.New(apperror.Conflict, "Ya tienes acceso a esto.")
}

func pendingExists() *apperror.Error {
	return apperror.New(apperror.Conflict, "Ya tienes una solicitud pendiente por esto.")
}

func alreadyDecided() *apperror.Error {
	return apperror.New(apperror.Conflict, "Esta solicitud ya fue resuelta.")
}
