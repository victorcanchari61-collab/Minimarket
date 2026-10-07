package permission

import (
	"fmt"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/apperror"
	"minimarket/backend/internal/auth"
	"minimarket/backend/internal/web"
)

const grantsKey = "permission.grants"

// Guard devuelve el Guard que se le entrega a los submódulos. Va detrás de
// auth.Required: usa el usuario que dejó en el contexto.
//
// Un código que no existe en el catálogo es un error de programación: se
// detecta al armar las rutas (al arrancar la API y en las pruebas), no con un
// 403 misterioso en producción.
func Guard(service *Service) web.Guard {
	return func(codes ...string) gin.HandlerFunc {
		for _, code := range codes {
			if !IsAction(code) || !service.catalog.Valid(code) {
				panic(fmt.Sprintf("permission: %q no es una acción del catálogo", code))
			}
		}

		return func(c *gin.Context) {
			grants, err := grantsOf(c, service)
			if err != nil {
				_ = c.Error(err)
				c.Abort()

				return
			}

			if !service.Allows(grants, codes...) {
				_ = c.Error(apperror.New(apperror.Forbidden, "No tienes permiso para realizar esta acción.").
					WithContext(map[string]any{"required": codes}))
				c.Abort()

				return
			}

			c.Next()
		}
	}
}

// grantsOf carga los permisos del usuario una sola vez por petición.
func grantsOf(c *gin.Context, service *Service) (Grants, error) {
	if cached, ok := c.Get(grantsKey); ok {
		return cached.(Grants), nil
	}

	grants, err := service.Grants(c.Request.Context(), auth.CurrentUser(c).ID)
	if err != nil {
		return Grants{}, err
	}

	c.Set(grantsKey, grants)

	return grants, nil
}
