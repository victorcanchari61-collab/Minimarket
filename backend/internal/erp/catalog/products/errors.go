package catalog

import (
	"errors"

	"minimarket/backend/internal/apperror"
)

// Errores internos del store: el servicio los traduce a errores de negocio.
var (
	errNotFound        = errors.New("catalog: no encontrado")
	errDuplicateSKU    = errors.New("catalog: sku repetido")
	errUnknownCategory = errors.New("catalog: categoría inexistente")
	errUnknownUnit     = errors.New("catalog: unidad inexistente")
)

func productNotFound() *apperror.Error {
	return apperror.New(apperror.NotFound, "El producto no existe.")
}

func skuTaken() *apperror.Error {
	err := apperror.New(apperror.Conflict, "Ya existe un producto con ese SKU.")
	err.Fields = map[string][]string{"sku": {err.Message}}

	return err
}

func invalidField(field, message string) *apperror.Error {
	return apperror.ValidationFields(map[string][]string{field: {message}})
}
