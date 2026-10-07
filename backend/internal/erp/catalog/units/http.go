package units

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/web"
)

// Handler traduce HTTP a llamadas al servicio. Es el único archivo del paquete
// que conoce a Gin.
type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Routes registra las rutas en un grupo que ya exige sesión. La lista también
// la necesita quien crea o edita productos, para elegir la unidad.
func (h *Handler) Routes(api *gin.RouterGroup, can web.Guard) {
	api.GET("/catalog/units", can(
		"erp.catalog.units.view",
		"erp.catalog.products.create",
		"erp.catalog.products.edit",
	), h.List)
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
