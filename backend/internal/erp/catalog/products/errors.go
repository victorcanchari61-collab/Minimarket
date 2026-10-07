package products

import (
	"errors"

	"minimarket/backend/internal/apperror"
)

// Errores internos del store: el servicio los traduce a errores de negocio.
var (
	errNotFound        = errors.New("products: no encontrado")
	errDuplicateSKU    = errors.New("products: sku repetido")
	errUnknownCategory = errors.New("products: categoría inexistente")
	errUnknownUnit     = errors.New("products: unidad inexistente")
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
