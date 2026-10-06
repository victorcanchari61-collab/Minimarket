// Package httpx reúne lo común de la capa HTTP: respuestas de error, validación
// de la entrada, límite de intentos y encabezados.
package web

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/apperror"
)

// Errors es el ÚNICO punto donde un error se convierte en respuesta JSON.
// Los handlers no escriben errores: hacen c.Error(err) y regresan.
//
//	validación           → 422 { message, code, errors: { campo: [...] } }
//	regla de negocio     → 4xx { message, code, context? }
//	error inesperado     → 500 { message }  (el detalle va al log, nunca al cliente)
func Errors() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) == 0 || c.Writer.Written() {
			return
		}

		err := c.Errors.Last().Err

		var appErr *apperror.Error
		if !errors.As(err, &appErr) {
			log.Printf("error inesperado: %s %s: %v", c.Request.Method, c.Request.URL.Path, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"message": "Error interno.",
				"code":    apperror.Internal,
			})

			return
		}

		body := gin.H{"message": appErr.Message, "code": appErr.Code}
		if len(appErr.Fields) > 0 {
			body["errors"] = appErr.Fields
		}
		if len(appErr.Context) > 0 {
			body["context"] = appErr.Context
		}

		c.AbortWithStatusJSON(appErr.Code.HTTPStatus(), body)
	}
}

// NotFound responde 404 en JSON para rutas que no existen.
func NotFound(c *gin.Context) {
	_ = c.Error(apperror.New(apperror.NotFound, "Recurso no encontrado."))
}
