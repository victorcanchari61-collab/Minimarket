package units

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

// Routes registra las rutas en un grupo que ya exige sesión.
func (h *Handler) Routes(api *gin.RouterGroup) {
	api.GET("/catalog/units", h.List)
}

type unitResource struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Abbreviation string `json:"abbreviation"`
}

// GET /api/catalog/units
func (h *Handler) List(c *gin.Context) {
	units, err := h.service.List(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]unitResource, len(units))
	for i, unit := range units {
		data[i] = unitResource{ID: unit.ID, Name: unit.Name, Abbreviation: unit.Abbreviation}
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}
