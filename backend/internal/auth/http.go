package auth

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/apperror"
	"minimarket/backend/internal/web"
)

// Handler traduce HTTP a llamadas al servicio. Sin lógica de negocio.
type Handler struct {
	service *Service
	isLocal bool
	// onDemoUser deja listo al usuario de prueba (por ejemplo, con su rol).
	onDemoUser func(ctx context.Context, userID int64) error
}

func NewHandler(service *Service, isLocal bool, onDemoUser func(ctx context.Context, userID int64) error) *Handler {
	return &Handler{service: service, isLocal: isLocal, onDemoUser: onDemoUser}
}

type loginRequest struct {
	Email      string `json:"email" binding:"required,email,max=255"`
	Password   string `json:"password" binding:"required,max=255"`
	DeviceName string `json:"device_name" binding:"omitempty,max=100"`
}

// POST /api/login
func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if !web.Bind(c, &req) {
		return
	}

	token, user, err := h.service.Login(c.Request.Context(), req.Email, req.Password, req.DeviceName)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":      token,
		"token_type": "Bearer",
		"user":       user.Resource(),
	})
}

// GET /api/user
func (h *Handler) Me(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": CurrentUser(c).Resource()})
}

// POST /api/logout
func (h *Handler) Logout(c *gin.Context) {
	if err := h.service.Logout(c.Request.Context(), CurrentTokenID(c)); err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sesión cerrada."})
}

// GET /api/demo-credentials — solo en local: ofrece (y crea) el usuario de prueba.
func (h *Handler) DemoCredentials(c *gin.Context) {
	if !h.isLocal {
		_ = c.Error(apperror.New(apperror.NotFound, "Recurso no encontrado."))

		return
	}

	user, err := h.service.EnsureDemoUser(c.Request.Context())
	if err == nil {
		err = h.onDemoUser(c.Request.Context(), user.ID)
	}

	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"email": DemoEmail, "password": DemoPassword}})
}
