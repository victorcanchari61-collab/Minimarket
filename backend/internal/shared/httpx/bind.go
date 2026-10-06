package httpx

import (
	"errors"
	"reflect"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"

	"minimarket/backend/internal/shared/apperror"
)

func init() {
	// Los errores de validación se nombran con el campo del JSON ("email"), no
	// con el de Go ("Email").
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		v.RegisterTagNameFunc(func(field reflect.StructField) string {
			name := strings.SplitN(field.Tag.Get("json"), ",", 2)[0]
			if name == "-" {
				return ""
			}

			return name
		})
	}
}

// Bind lee el cuerpo JSON y lo valida con las etiquetas `binding`. Si algo falla
// registra un error de validación y devuelve false: el handler solo regresa.
func Bind(c *gin.Context, target any) bool {
	err := c.ShouldBindJSON(target)
	if err == nil {
		return true
	}

	fields := map[string][]string{}

	var invalid validator.ValidationErrors
	if errors.As(err, &invalid) {
		for _, fieldErr := range invalid {
			fields[fieldErr.Field()] = append(fields[fieldErr.Field()], messageFor(fieldErr))
		}
	} else {
		fields["body"] = []string{"El cuerpo de la petición no es un JSON válido."}
	}

	_ = c.Error(apperror.ValidationFields(fields))

	return false
}

func messageFor(err validator.FieldError) string {
	switch err.Tag() {
	case "required":
		return "Este campo es obligatorio."
	case "email":
		return "Escribe un correo electrónico válido."
	case "max":
		return "Es demasiado largo (máximo " + err.Param() + " caracteres)."
	case "min":
		return "Es demasiado corto (mínimo " + err.Param() + " caracteres)."
	default:
		return "El valor no es válido."
	}
}
