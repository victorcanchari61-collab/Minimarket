package series

import (
	"errors"

	"minimarket/backend/internal/apperror"
)

var (
	errNotFound  = errors.New("series: no encontrada")
	errDuplicate = errors.New("series: serie repetida para ese tipo")
)

func seriesNotFound() *apperror.Error {
	return apperror.New(apperror.NotFound, "La serie no existe.")
}

func duplicated() *apperror.Error {
	err := apperror.New(apperror.Conflict, "Ya existe esa serie para ese tipo de comprobante.")
	err.Fields = map[string][]string{"series": {err.Message}}

	return err
}

func invalidField(field, message string) *apperror.Error {
	return apperror.ValidationFields(map[string][]string{field: {message}})
}

func seriesUsed(action string) *apperror.Error {
	return apperror.New(apperror.Conflict,
		"La serie ya emitió comprobantes: no se puede "+action+". Si ya no se usa, desactívala.")
}
