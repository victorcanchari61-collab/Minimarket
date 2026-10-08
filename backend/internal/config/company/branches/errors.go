package branches

import (
	"errors"
	"fmt"

	"minimarket/backend/internal/apperror"
)

// Errores internos del store: el servicio los traduce a errores de negocio.
var (
	errNotFound       = errors.New("branches: no encontrada")
	errDuplicateCode  = errors.New("branches: código repetido")
	errDuplicateSunat = errors.New("branches: establecimiento SUNAT repetido")
)

func branchNotFound() *apperror.Error {
	return apperror.New(apperror.NotFound, "La sucursal no existe.")
}

func codeTaken() *apperror.Error {
	err := apperror.New(apperror.Conflict, "Ya existe una sucursal con ese código.")
	err.Fields = map[string][]string{"code": {err.Message}}

	return err
}

func sunatTaken() *apperror.Error {
	err := apperror.New(apperror.Conflict, "Ya hay una sucursal con ese código de establecimiento SUNAT.")
	err.Fields = map[string][]string{"sunat_code": {err.Message}}

	return err
}

func invalidField(field, message string) *apperror.Error {
	return apperror.ValidationFields(map[string][]string{field: {message}})
}

func branchInUse(users, warehouses int64) *apperror.Error {
	reason := "Tiene"
	if warehouses > 0 {
		reason += fmt.Sprintf(" %d almacén(es)", warehouses)
	}

	if users > 0 {
		if warehouses > 0 {
			reason += " y"
		}

		reason += fmt.Sprintf(" %d usuario(s) asignado(s)", users)
	}

	return apperror.New(apperror.Conflict,
		reason+". Pásalos a otra sucursal o elimínalos antes de eliminarla, o desactívala si solo quieres dejar de usarla.").
		WithContext(map[string]any{"users": users, "warehouses": warehouses})
}
