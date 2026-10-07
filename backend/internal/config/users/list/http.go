package list

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/auth"
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
	view := can("config.users.list.view")

	api.GET("/users", view, h.List)
	api.POST("/users", can("config.users.list.create"), h.Create)
	api.GET("/users/summary", view, h.Summary) // antes de :id
	api.GET("/users/roles", view, h.Roles)
	api.GET("/users/:id", view, h.Show)
	api.PUT("/users/:id", can("config.users.list.edit"), h.Update)
	api.PUT("/users/:id/password", can("config.users.list.reset_password"), h.ResetPassword)
	api.DELETE("/users/:id", can("config.users.list.delete"), h.Delete)
}

// --- entrada ----------------------------------------------------------------

type listQuery struct {
	Search    string `form:"search" binding:"omitempty,min=2,max=100"`
	RoleID    *int64 `form:"role_id" binding:"omitempty,gt=0"`
	Status    string `form:"status" binding:"omitempty,oneof=active inactive"`
	Sort      string `form:"sort" binding:"omitempty,oneof=name email status created"`
	Direction string `form:"direction" binding:"omitempty,oneof=asc desc"`
	Cursor    string `form:"cursor" binding:"omitempty,max=500"`
}

type createRequest struct {
	Name     string  `json:"name" binding:"required,max=150"`
	Email    string  `json:"email" binding:"required,email,max=255"`
	Password string  `json:"password" binding:"required,min=8,max=100"`
	Status   string  `json:"status" binding:"omitempty,oneof=active inactive"`
	RoleIDs  []int64 `json:"role_ids" binding:"omitempty,max=50,dive,gt=0"`
}

type updateRequest struct {
	Name    string  `json:"name" binding:"required,max=150"`
	Email   string  `json:"email" binding:"required,email,max=255"`
	Status  string  `json:"status" binding:"omitempty,oneof=active inactive"`
	RoleIDs []int64 `json:"role_ids" binding:"omitempty,max=50,dive,gt=0"`
}

type passwordRequest struct {
	Password string `json:"password" binding:"required,min=8,max=100"`
}

// --- salida -----------------------------------------------------------------

type roleResource struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type userResource struct {
	ID          int64          `json:"id"`
	Name        string         `json:"name"`
	Email       string         `json:"email"`
	Status      string         `json:"status"`
	StatusLabel string         `json:"status_label"`
	Roles       []roleResource `json:"roles"`
	CreatedAt   time.Time      `json:"created_at"`
}

func resource(u User) userResource {
	roles := make([]roleResource, len(u.Roles))
	for i, r := range u.Roles {
		roles[i] = roleResource{ID: r.ID, Name: r.Name}
	}

	return userResource{
		ID: u.ID, Name: u.Name, Email: u.Email,
		Status: string(u.Status), StatusLabel: u.Status.Label(),
		Roles: roles, CreatedAt: u.CreatedAt,
	}
}

// --- handlers ---------------------------------------------------------------

// GET /api/users — 20 usuarios por petición, paginados por cursor.
func (h *Handler) List(c *gin.Context) {
	var q listQuery
	if !web.BindQuery(c, &q) {
		return
	}

	page, err := h.service.List(c.Request.Context(), Filter{
		Search: q.Search,
		RoleID: q.RoleID,
		Status: Status(q.Status),
		Sort:   q.Sort,
		Desc:   q.Direction == "desc",
		Cursor: q.Cursor,
	})
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]userResource, len(page.Data))
	for i, u := range page.Data {
		data[i] = resource(u)
	}

	c.JSON(http.StatusOK, pagination.Page[userResource]{Data: data, Meta: page.Meta})
}

func (h *Handler) Show(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	user, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(user)})
}

func (h *Handler) Create(c *gin.Context) {
	var req createRequest
	if !web.Bind(c, &req) {
		return
	}

	user, err := h.service.Create(c.Request.Context(), Input{
		Name: req.Name, Email: req.Email, Password: req.Password,
		Status: Status(req.Status), RoleIDs: req.RoleIDs,
	})
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": resource(user)})
}

func (h *Handler) Update(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var req updateRequest
	if !web.Bind(c, &req) {
		return
	}

	user, err := h.service.Update(c.Request.Context(), auth.CurrentUser(c).ID, id, Input{
		Name: req.Name, Email: req.Email, Status: Status(req.Status), RoleIDs: req.RoleIDs,
	})
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(user)})
}

func (h *Handler) ResetPassword(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var req passwordRequest
	if !web.Bind(c, &req) {
		return
	}

	if err := h.service.ResetPassword(c.Request.Context(), auth.CurrentUser(c).ID, id, req.Password); err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Contraseña actualizada."})
}

func (h *Handler) Delete(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	if err := h.service.Delete(c.Request.Context(), auth.CurrentUser(c).ID, id); err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Usuario eliminado."})
}

func (h *Handler) Summary(c *gin.Context) {
	summary, err := h.service.Summary(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"active":   summary.Active,
		"inactive": summary.Inactive,
	}})
}

// GET /api/users/roles — los roles que se pueden elegir al crear o editar.
func (h *Handler) Roles(c *gin.Context) {
	roles, err := h.service.Roles(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]roleResource, len(roles))
	for i, r := range roles {
		data[i] = roleResource{ID: r.ID, Name: r.Name}
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// idParam lee :id; un id que no es número se trata como "no existe".
func idParam(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		_ = c.Error(userNotFound())

		return 0, false
	}

	return id, true
}
