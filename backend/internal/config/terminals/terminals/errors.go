package terminals

import (
	"errors"
	"fmt"

	"minimarket/backend/internal/apperror"
)

// Errores internos del store: el servicio los traduce a errores de negocio.
var (
	errNotFound      = errors.New("terminals: no encontrada")
	errDuplicateCode = errors.New("terminals: código repetido en la sucursal")
)

func terminalNotFound() *apperror.Error {
	return apperror.New(apperror.NotFound, "La terminal no existe.")
}

func codeTaken() *apperror.Error {
	err := apperror.New(apperror.Conflict, "Esa sucursal ya tiene una terminal con ese código.")
	err.Fields = map[string][]string{"code": {err.Message}}

	return err
}

func invalidField(field, message string) *apperror.Error {
	return apperror.ValidationFields(map[string][]string{field: {message}})
}

func terminalInUse(series int64) *apperror.Error {
	return apperror.New(apperror.Conflict,
		fmt.Sprintf("Tiene %d serie(s) de comprobantes asignada(s). Pásalas a otra terminal o elimínalas antes de eliminarla, o desactívala si solo quieres dejar de usarla.", series)).
		WithContext(map[string]any{"series": series})
}
