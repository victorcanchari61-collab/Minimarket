package branches

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/auth"
	"minimarket/backend/internal/web"
)

// Handler traduce HTTP a llamadas al servicio. Es el único código del paquete
// que conoce a Gin (http.go y http_manage.go).
type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Routes registra las rutas en un grupo que ya exige sesión.
//
// /company/branches es la lista para el selector de la cuenta: no pide permiso
// (cualquiera necesita elegir su sucursal) y trae solo las del usuario. Las
// rutas de /branches son la administración y piden el permiso de su acción.
func (h *Handler) Routes(api *gin.RouterGroup, can web.Guard) {
	api.GET("/company/branches", h.List)

	view := can("config.company.branches.view")

	api.GET("/branches", view, h.Page)
	api.POST("/branches", can("config.company.branches.create"), h.Create)
	api.GET("/branches/summary", view, h.Summary) // antes de :id
	api.GET("/branches/:id", view, h.Show)
	api.PUT("/branches/:id", can("config.company.branches.edit"), h.Update)
	api.DELETE("/branches/:id", can("config.company.branches.delete"), h.Delete)
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
	branches, err := h.service.List(c.Request.Context(), auth.CurrentUser(c).ID)
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
