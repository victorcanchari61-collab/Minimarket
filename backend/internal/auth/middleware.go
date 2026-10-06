package auth

import (
	"strings"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/apperror"
)

const (
	userKey    = "auth.user"
	tokenIDKey = "auth.token_id"
)

// Required exige un token Bearer válido; deja el usuario en el contexto.
func Required(service *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")

		plain, found := strings.CutPrefix(header, "Bearer ")
		if !found || strings.TrimSpace(plain) == "" {
			_ = c.Error(apperror.New(apperror.Unauthenticated, "No has iniciado sesión."))
			c.Abort()

			return
		}

		user, tokenID, err := service.Authenticate(c.Request.Context(), strings.TrimSpace(plain))
		if err != nil {
			_ = c.Error(err)
			c.Abort()

			return
		}

		c.Set(userKey, user)
		c.Set(tokenIDKey, tokenID)
		c.Next()
	}
}

// CurrentUser es el usuario de la petición (solo detrás de Required).
func CurrentUser(c *gin.Context) User {
	return c.MustGet(userKey).(User)
}

// CurrentTokenID es el token con el que llegó la petición (solo detrás de Required).
func CurrentTokenID(c *gin.Context) int64 {
	return c.MustGet(tokenIDKey).(int64)
}
