package info

import (
	"errors"

	"minimarket/backend/internal/apperror"
)

// Errores internos del store: el servicio los traduce a errores de negocio.
var (
	errNotFound     = errors.New("company: no encontrada")
	errDuplicateRUC = errors.New("company: ruc repetido")
)

func companyNotFound() *apperror.Error {
	return apperror.New(apperror.NotFound, "Todavía no hay una empresa registrada.")
}

func rucTaken() *apperror.Error {
	err := apperror.New(apperror.Conflict, "Ya existe una empresa con ese RUC.")
	err.Fields = map[string][]string{"ruc": {err.Message}}

	return err
}

func invalidField(field, message string) *apperror.Error {
	return apperror.ValidationFields(map[string][]string{field: {message}})
}
