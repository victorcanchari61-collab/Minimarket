package branches

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler traduce HTTP a llamadas al servicio. Es el único archivo del paquete
// que conoce a Gin.
type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Routes registra las rutas en un grupo que ya exige sesión. La lista no pide
// permiso: cualquiera que inicie sesión necesita elegir su sucursal.
func (h *Handler) Routes(api *gin.RouterGroup) {
	api.GET("/company/branches", h.List)
}

type branchResource struct {
	ID        int64  `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	Address   string `json:"address"`
	Kind      string `json:"kind"`
	KindLabel string `json:"kind_label"`
}

// GET /api/company/branches
func (h *Handler) List(c *gin.Context) {
	branches, err := h.service.List(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]branchResource, len(branches))
	for i, b := range branches {
		data[i] = branchResource{
			ID: b.ID, Code: b.Code, Name: b.Name, Address: b.Address,
			Kind: string(b.Kind), KindLabel: b.Kind.Label(),
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}
