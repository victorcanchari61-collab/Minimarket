package permission

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/auth"
	"minimarket/backend/internal/web"
)

// Handler traduce HTTP a llamadas al servicio.
type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Routes registra las rutas en un grupo que ya exige sesión.
func (h *Handler) Routes(api *gin.RouterGroup, can web.Guard) {
	api.GET("/permissions/me", h.Me)
	api.GET("/permissions/catalog", can("config.roles.permissions.view"), h.Catalog)
}

// GET /api/permissions/me — lo que puede hacer quien hace la petición.
func (h *Handler) Me(c *gin.Context) {
	grants, actions, err := h.service.Me(c.Request.Context(), auth.CurrentUser(c).ID)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"superuser":   grants.Superuser,
		"permissions": actions,
	}})
}

type actionResource struct {
	Code  string `json:"code"`
	Label string `json:"label"`
}

type nodeResource struct {
	Code     string           `json:"code"`
	Label    string           `json:"label"`
	Children []nodeResource   `json:"children,omitempty"`
	Actions  []actionResource `json:"actions,omitempty"`
}

// GET /api/permissions/catalog — el árbol completo: sistema → módulo → submódulo → acciones.
func (h *Handler) Catalog(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": tree(h.service.Catalog())})
}

func tree(catalog *Catalog) []nodeResource {
	systems := make([]nodeResource, 0, len(catalog.Systems))

	for _, s := range catalog.Systems {
		system := nodeResource{Code: s.Code, Label: s.Label}

		for _, m := range s.Modules {
			module := nodeResource{Code: s.Code + "." + m.Code, Label: m.Label}

			for _, sm := range m.Submodules {
				base := module.Code + "." + sm.Code
				submodule := nodeResource{
					Code:    base,
					Label:   sm.Label,
					Actions: []actionResource{{Code: base + "." + ViewAction, Label: "Ver"}},
				}

				for _, a := range sm.Actions {
					submodule.Actions = append(submodule.Actions, actionResource{Code: base + "." + a.Code, Label: a.Label})
				}

				module.Children = append(module.Children, submodule)
			}

			system.Children = append(system.Children, module)
		}

		systems = append(systems, system)
	}

	return systems
}
