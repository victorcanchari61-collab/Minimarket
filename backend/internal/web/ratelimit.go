package httpx

import (
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/shared/apperror"
)

type window struct {
	count   int
	resetAt time.Time
}

// RateLimit permite `limit` peticiones por ventana y por IP (ventana fija, en
// memoria). Sirve para el login; si algún día hay varias instancias del
// servicio, se pasa a un almacén compartido.
func RateLimit(limit int, per time.Duration) gin.HandlerFunc {
	var (
		mu      sync.Mutex
		windows = map[string]*window{}
	)

	return func(c *gin.Context) {
		now := time.Now()
		ip := c.ClientIP()

		mu.Lock()

		// Limpieza barata: las ventanas vencidas se descartan al paso.
		for key, w := range windows {
			if now.After(w.resetAt) {
				delete(windows, key)
			}
		}

		w, ok := windows[ip]
		if !ok {
			w = &window{resetAt: now.Add(per)}
			windows[ip] = w
		}

		w.count++
		blocked := w.count > limit
		retry := int(w.resetAt.Sub(now).Seconds()) + 1

		mu.Unlock()

		if blocked {
			c.Header("Retry-After", strconv.Itoa(retry))
			_ = c.Error(apperror.New(apperror.TooManyRequests,
				"Demasiados intentos. Espera un momento e inténtalo de nuevo.").
				WithContext(map[string]any{"retry_after": retry}))
			c.Abort()

			return
		}

		c.Next()
	}
}
