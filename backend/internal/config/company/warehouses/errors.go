package warehouses

import (
	"errors"

	"minimarket/backend/internal/apperror"
)

// Errores internos del store: el servicio los traduce a errores de negocio.
var (
	errNotFound      = errors.New("warehouses: no encontrado")
	errDuplicateCode = errors.New("warehouses: código repetido en la sucursal")
	errUnknownBranch = errors.New("warehouses: sucursal inexistente")
)

func warehouseNotFound() *apperror.Error {
	return apperror.New(apperror.NotFound, "El almacén no existe.")
}

func codeTaken() *apperror.Error {
	err := apperror.New(apperror.Conflict, "Esa sucursal ya tiene un almacén con ese código.")
	err.Fields = map[string][]string{"code": {err.Message}}

	return err
}

func invalidField(field, message string) *apperror.Error {
	return apperror.ValidationFields(map[string][]string{field: {message}})
}
