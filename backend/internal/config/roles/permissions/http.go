package permissions

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/apperror"
	"minimarket/backend/internal/auth"
	"minimarket/backend/internal/web"
)

// Handler traduce HTTP a llamadas al servicio. Es el único código del paquete
// que conoce a Gin (http.go y http_requests.go); sin reglas de negocio.
type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Routes registra las rutas en un grupo que ya exige sesión. Mirar pide
// "ver"; cambiar accesos y resolver solicitudes pide "asignar". Pedir acceso
// a algo lo puede hacer cualquiera con sesión: es justo para quien no tiene permisos.
func (h *Handler) Routes(api *gin.RouterGroup, can web.Guard) {
	view := can("config.roles.permissions.view")
	assign := can("config.roles.permissions.assign")

	api.GET("/access/roles", view, h.Roles)
	api.PUT("/access/roles/:id", assign, h.SetRole)

	api.GET("/access/users", view, h.Persons)
	api.GET("/access/users/:id", view, h.Person)
	api.PUT("/access/users/:id", assign, h.SetPerson)

	api.POST("/access/requests", h.RequestAccess)
	api.GET("/access/requests", view, h.Requests)
	api.GET("/access/requests/summary", view, h.PendingRequests)
	api.POST("/access/requests/:id/approve", assign, h.Approve)
	api.POST("/access/requests/:id/reject", assign, h.Reject)
}

// --- entrada ----------------------------------------------------------------

type rolePermissionsRequest struct {
	Permissions []string `json:"permissions" binding:"omitempty,max=1000,dive,max=120"`
}

type personAccessRequest struct {
	Allow []string `json:"allow" binding:"omitempty,max=1000,dive,max=120"`
	Deny  []string `json:"deny" binding:"omitempty,max=1000,dive,max=120"`
}

// --- salida -----------------------------------------------------------------

type roleResource struct {
	ID          int64    `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	IsSystem    bool     `json:"is_system"`
	UserCount   int64    `json:"user_count"`
	Permissions []string `json:"permissions"`
}

type personResource struct {
	ID      int64    `json:"id"`
	Code    string   `json:"code"`
	Name    string   `json:"name"`
	Email   string   `json:"email"`
	Active  bool     `json:"active"`
	IsAdmin bool     `json:"is_admin"`
	Roles   []string `json:"roles"`
}

type roleRefResource struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func personOf(p Person) personResource {
	return personResource{
		ID: p.ID, Code: p.Code, Name: p.Name, Email: p.Email,
		Active: p.Active, IsAdmin: p.IsAdmin, Roles: p.Roles,
	}
}

// --- handlers: por rol ------------------------------------------------------

// GET /api/access/roles — todos los roles con lo que dan.
func (h *Handler) Roles(c *gin.Context) {
	roles, err := h.service.Roles(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]roleResource, len(roles))
	for i, r := range roles {
		data[i] = roleResource{
			ID: r.ID, Name: r.Name, Description: r.Description, IsSystem: r.IsSystem,
			UserCount: r.UserCount, Permissions: r.Permissions,
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// PUT /api/access/roles/:id — reemplaza los permisos de un rol.
func (h *Handler) SetRole(c *gin.Context) {
	id, ok := idParam(c, roleNotFound)
	if !ok {
		return
	}

	var req rolePermissionsRequest
	if !web.Bind(c, &req) {
		return
	}

	if err := h.service.SetRolePermissions(c.Request.Context(), id, req.Permissions); err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Accesos del rol actualizados."})
}

// --- handlers: por persona --------------------------------------------------

// GET /api/access/users?search= — busca personas (20 como máximo).
func (h *Handler) Persons(c *gin.Context) {
	persons, err := h.service.Persons(c.Request.Context(), c.Query("search"))
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]personResource, len(persons))
	for i, p := range persons {
		data[i] = personOf(p)
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func accessResource(a PersonAccess) gin.H {
	roles := make([]roleRefResource, len(a.Roles))
	for i, r := range a.Roles {
		roles[i] = roleRefResource{ID: r.ID, Name: r.Name}
	}

	return gin.H{
		"person":           personOf(a.Person),
		"roles":            roles,
		"role_permissions": a.RolePermissions,
		"allow":            a.Allow,
		"deny":             a.Deny,
	}
}

// GET /api/access/users/:id — lo que puede la persona y de dónde le viene.
func (h *Handler) Person(c *gin.Context) {
	id, ok := idParam(c, userNotFound)
	if !ok {
		return
	}

	access, err := h.service.Person(c.Request.Context(), id)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": accessResource(access)})
}

// PUT /api/access/users/:id — reemplaza lo que se le da y lo que se le quita.
func (h *Handler) SetPerson(c *gin.Context) {
	id, ok := idParam(c, userNotFound)
	if !ok {
		return
	}

	var req personAccessRequest
	if !web.Bind(c, &req) {
		return
	}

	access, err := h.service.SetPersonAccess(c.Request.Context(), auth.CurrentUser(c).ID, id, req.Allow, req.Deny)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": accessResource(access)})
}

// idParam lee :id; un id que no es número se trata como "no existe".
func idParam(c *gin.Context, notFound func() *apperror.Error) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		_ = c.Error(notFound())

		return 0, false
	}

	return id, true
}
