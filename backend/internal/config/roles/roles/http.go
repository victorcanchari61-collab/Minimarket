package roles

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/pagination"
	"minimarket/backend/internal/web"
)

// Handler traduce HTTP a llamadas al servicio. Es el único archivo del paquete
// que conoce a Gin; sin reglas de negocio.
type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Routes registra las rutas en un grupo que ya exige sesión. Cada una pide el
// permiso de su acción ("ver" lo incluye cualquier otra).
func (h *Handler) Routes(api *gin.RouterGroup, can web.Guard) {
	view := can("config.roles.roles.view")

	api.GET("/roles", view, h.List)
	api.POST("/roles", can("config.roles.roles.create"), h.Create)
	api.GET("/roles/:id", view, h.Show)
	api.PUT("/roles/:id", can("config.roles.roles.edit"), h.Update)
	api.DELETE("/roles/:id", can("config.roles.roles.delete"), h.Delete)
}

// --- entrada ----------------------------------------------------------------

type listQuery struct {
	Search    string `form:"search" binding:"omitempty,min=2,max=100"`
	Sort      string `form:"sort" binding:"omitempty,oneof=name created"`
	Direction string `form:"direction" binding:"omitempty,oneof=asc desc"`
	Cursor    string `form:"cursor" binding:"omitempty,max=500"`
}

type roleRequest struct {
	Name        string   `json:"name" binding:"required,max=80"`
	Description string   `json:"description" binding:"omitempty,max=200"`
	Permissions []string `json:"permissions" binding:"omitempty,max=1000,dive,max=120"`
}

func (r roleRequest) input() Input {
	return Input{Name: r.Name, Description: r.Description, Permissions: r.Permissions}
}

// --- salida -----------------------------------------------------------------

type roleResource struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IsSystem    bool      `json:"is_system"`
	UserCount   int64     `json:"user_count"`
	Permissions []string  `json:"permissions"`
	CreatedAt   time.Time `json:"created_at"`
}

func resource(r Role) roleResource {
	return roleResource{
		ID: r.ID, Name: r.Name, Description: r.Description, IsSystem: r.IsSystem(),
		UserCount: r.UserCount, Permissions: r.Permissions, CreatedAt: r.CreatedAt,
	}
}

// --- handlers ---------------------------------------------------------------

// GET /api/roles — 20 roles por petición, paginados por cursor.
func (h *Handler) List(c *gin.Context) {
	var q listQuery
	if !web.BindQuery(c, &q) {
		return
	}

	fields, ok := web.BindFields[roleResource](c)
	if !ok {
		return
	}

	page, err := h.service.List(c.Request.Context(), Filter{
		Search: q.Search, Sort: q.Sort, Desc: q.Direction == "desc", Cursor: q.Cursor,
		SkipPermissions: !fields.Wants("permissions"),
		SkipUserCount:   !fields.Wants("user_count"),
	})
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]any, len(page.Data))
	for i, r := range page.Data {
		data[i] = web.Pick(resource(r), fields)
	}

	c.JSON(http.StatusOK, pagination.Page[any]{Data: data, Meta: page.Meta})
}

func (h *Handler) Show(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	role, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(role)})
}

func (h *Handler) Create(c *gin.Context) {
	var req roleRequest
	if !web.Bind(c, &req) {
		return
	}

	role, err := h.service.Create(c.Request.Context(), req.input())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": resource(role)})
}

func (h *Handler) Update(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var req roleRequest
	if !web.Bind(c, &req) {
		return
	}

	role, err := h.service.Update(c.Request.Context(), id, req.input())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(role)})
}

func (h *Handler) Delete(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Rol eliminado."})
}

// idParam lee :id; un id que no es número se trata como "no existe".
func idParam(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		_ = c.Error(roleNotFound())

		return 0, false
	}

	return id, true
}
