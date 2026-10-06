package web

import (
	"errors"
	"reflect"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"

	"minimarket/backend/internal/apperror"
)

func init() {
	// Los errores de validación se nombran con el campo del JSON o del query
	// ("email", "category_id"), no con el de Go ("Email").
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		v.RegisterTagNameFunc(func(field reflect.StructField) string {
			for _, tag := range []string{"json", "form"} {
				name := strings.SplitN(field.Tag.Get(tag), ",", 2)[0]
				if name != "" && name != "-" {
					return name
				}
			}

			return ""
		})
	}
}

// Bind lee el cuerpo JSON y lo valida con las etiquetas `binding`. Si algo falla
// registra un error de validación y devuelve false: el handler solo regresa.
func Bind(c *gin.Context, target any) bool {
	return report(c, c.ShouldBindJSON(target), "El cuerpo de la petición no es un JSON válido.")
}

// BindQuery hace lo mismo con los parámetros de la URL (etiquetas `form`).
func BindQuery(c *gin.Context, target any) bool {
	return report(c, c.ShouldBindQuery(target), "Los parámetros de la URL no son válidos.")
}

func report(c *gin.Context, err error, fallback string) bool {
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
		fields["body"] = []string{fallback}
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
	case "gt":
		return "Debe ser mayor que " + err.Param() + "."
	case "oneof":
		return "Debe ser uno de: " + strings.ReplaceAll(err.Param(), " ", ", ") + "."
	default:
		return "El valor no es válido."
	}
}
