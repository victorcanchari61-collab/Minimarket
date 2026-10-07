// Package server arma el enrutador: middleware global, rutas de cada módulo y
// los chequeos de salud.
package server

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"minimarket/backend/internal/auth"
	"minimarket/backend/internal/erp/catalog/products"
	"minimarket/backend/internal/erp/catalog/units"
	"minimarket/backend/internal/permission"
	"minimarket/backend/internal/platform/config"
	"minimarket/backend/internal/web"
)

func New(cfg config.Config, pool *pgxpool.Pool) *gin.Engine {
	if cfg.IsLocal() {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery(), web.Errors())
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Retry-After"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))
	router.NoRoute(web.NotFound)

	// Chequeo de vida: no toca la base de datos.
	router.GET("/up", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := router.Group("/api")

	// Chequeo de salud con la base de datos.
	api.GET("/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		if err := pool.Ping(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "database_unavailable"})

			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	authService := auth.NewService(auth.NewStore(pool), cfg.TokenTTL)
	permissions := permission.New(pool)
	can := permission.Guard(permissions)
	authHandler := auth.NewHandler(authService, cfg.IsLocal(), permissions.AssignAdmin)

	api.POST("/login", web.RateLimit(5, time.Minute), authHandler.Login)
	api.GET("/demo-credentials", authHandler.DemoCredentials)

	protected := api.Group("", auth.Required(authService))
	protected.GET("/user", authHandler.Me)
	protected.POST("/logout", authHandler.Logout)

	permission.NewHandler(permissions).Routes(protected, can)

	// ERP › Catálogo y maestros.
	products.New(pool).Routes(protected, can)
	units.New(pool).Routes(protected, can)

	return router
}
