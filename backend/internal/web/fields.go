package web

import (
	"fmt"
	"reflect"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/apperror"
)

// Fields son los campos que el cliente pidió con ?fields=nombre,correo. Un
// listado devuelve solo esos (y siempre `id`): la tabla pide lo que muestra y
// no se envía ni se calcula lo demás. nil significa "sin ?fields": todos.
type Fields map[string]bool

// Wants dice si el campo se pidió. Sin ?fields (nil) se pide todo.
func (f Fields) Wants(names ...string) bool {
	if f == nil {
		return true
	}

	for _, name := range names {
		if f[name] {
			return true
		}
	}

	return false
}

// BindFields lee ?fields= y lo valida contra los campos JSON de T, el recurso
// del listado: un nombre que no existe es un error 422 que lista los válidos
// (así un error de tipeo en el cliente se nota al instante, no como una
// columna vacía).
func BindFields[T any](c *gin.Context) (Fields, bool) {
	raw := strings.TrimSpace(c.Query("fields"))
	if raw == "" {
		return nil, true
	}

	known := jsonNames[T]()
	fields := Fields{}

	for _, name := range strings.Split(raw, ",") {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}

		if !known[name] {
			valid := make([]string, 0, len(known))
			for k := range known {
				valid = append(valid, k)
			}

			sort.Strings(valid)

			_ = c.Error(apperror.ValidationFields(map[string][]string{
				"fields": {fmt.Sprintf("El campo «%s» no existe. Disponibles: %s.", name, strings.Join(valid, ", "))},
			}))

			return nil, false
		}

		fields[name] = true
	}

	return fields, true
}

// Pick devuelve el recurso con solo los campos pedidos, más `id`. Sin ?fields
// lo devuelve completo.
func Pick[T any](resource T, fields Fields) any {
	if fields == nil {
		return resource
	}

	value := reflect.ValueOf(resource)
	out := make(map[string]any, len(fields)+1)

	for i := 0; i < value.NumField(); i++ {
		name := jsonName(value.Type().Field(i))
		if name == "id" || (name != "" && fields[name]) {
			out[name] = value.Field(i).Interface()
		}
	}

	return out
}

func jsonNames[T any]() map[string]bool {
	var zero T

	t := reflect.TypeOf(zero)
	names := make(map[string]bool, t.NumField())

	for i := 0; i < t.NumField(); i++ {
		if name := jsonName(t.Field(i)); name != "" {
			names[name] = true
		}
	}

	return names
}

func jsonName(field reflect.StructField) string {
	name := strings.SplitN(field.Tag.Get("json"), ",", 2)[0]
	if name == "-" {
		return ""
	}

	return name
}
