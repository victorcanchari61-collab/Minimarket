package warehouses

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
	view := can("config.company.warehouses.view")

	api.GET("/warehouses", view, h.List)
	api.POST("/warehouses", can("config.company.warehouses.create"), h.Create)
	api.GET("/warehouses/summary", view, h.Summary) // antes de :id
	api.GET("/warehouses/branches", view, h.Branches)
	api.GET("/warehouses/:id", view, h.Show)
	api.PUT("/warehouses/:id", can("config.company.warehouses.edit"), h.Update)
	api.DELETE("/warehouses/:id", can("config.company.warehouses.delete"), h.Delete)
}

// --- entrada ----------------------------------------------------------------

type listQuery struct {
	Search    string `form:"search" binding:"omitempty,min=2,max=100"`
	BranchID  *int64 `form:"branch_id" binding:"omitempty,gt=0"`
	Status    string `form:"status" binding:"omitempty,oneof=active inactive"`
	Sort      string `form:"sort" binding:"omitempty,oneof=code name status created"`
	Direction string `form:"direction" binding:"omitempty,oneof=asc desc"`
	Cursor    string `form:"cursor" binding:"omitempty,max=500"`
}

type warehouseRequest struct {
	BranchID int64  `json:"branch_id" binding:"required,gt=0"`
	Code     string `json:"code" binding:"required,max=15"`
	Name     string `json:"name" binding:"required,max=100"`
	Address  string `json:"address" binding:"omitempty,max=200"`
	Active   *bool  `json:"active"`
}

func (r warehouseRequest) input() Input {
	active := true // un almacén nuevo arranca activo
	if r.Active != nil {
		active = *r.Active
	}

	return Input{BranchID: r.BranchID, Code: r.Code, Name: r.Name, Address: r.Address, Active: active}
}

// --- salida -----------------------------------------------------------------

type warehouseResource struct {
	ID         int64     `json:"id"`
	BranchID   int64     `json:"branch_id"`
	BranchName string    `json:"branch_name"`
	Code       string    `json:"code"`
	Name       string    `json:"name"`
	Address    string    `json:"address"`
	Active     bool      `json:"active"`
	CreatedAt  time.Time `json:"created_at"`
}

func resource(w Warehouse) warehouseResource {
	return warehouseResource{
		ID: w.ID, BranchID: w.BranchID, BranchName: w.BranchName, Code: w.Code, Name: w.Name,
		Address: w.Address, Active: w.Active, CreatedAt: w.CreatedAt,
	}
}

// --- handlers ---------------------------------------------------------------

// GET /api/warehouses — 20 almacenes por petición, paginados por cursor.
func (h *Handler) List(c *gin.Context) {
	var q listQuery
	if !web.BindQuery(c, &q) {
		return
	}

	filter := Filter{
		Search: q.Search, BranchID: q.BranchID, Sort: q.Sort, Desc: q.Direction == "desc", Cursor: q.Cursor,
	}

	if q.Status != "" {
		active := q.Status == "active"
		filter.Active = &active
	}

	page, err := h.service.List(c.Request.Context(), filter)
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]warehouseResource, len(page.Data))
	for i, w := range page.Data {
		data[i] = resource(w)
	}

	c.JSON(http.StatusOK, pagination.Page[warehouseResource]{Data: data, Meta: page.Meta})
}

func (h *Handler) Show(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	warehouse, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(warehouse)})
}

func (h *Handler) Create(c *gin.Context) {
	var req warehouseRequest
	if !web.Bind(c, &req) {
		return
	}

	warehouse, err := h.service.Create(c.Request.Context(), req.input())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": resource(warehouse)})
}

func (h *Handler) Update(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var req warehouseRequest
	if !web.Bind(c, &req) {
		return
	}

	warehouse, err := h.service.Update(c.Request.Context(), id, req.input())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(warehouse)})
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

	c.JSON(http.StatusOK, gin.H{"message": "Almacén eliminado."})
}

func (h *Handler) Summary(c *gin.Context) {
	summary, err := h.service.Summary(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"active":           summary.Active,
		"inactive":         summary.Inactive,
		"branches_without": summary.BranchesWithout,
	}})
}

// GET /api/warehouses/branches — las sucursales donde se puede poner un almacén.
func (h *Handler) Branches(c *gin.Context) {
	branches, err := h.service.Branches(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]gin.H, len(branches))
	for i, b := range branches {
		data[i] = gin.H{"id": b.ID, "code": b.Code, "name": b.Name}
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// idParam lee :id; un id que no es número se trata como "no existe".
func idParam(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		_ = c.Error(warehouseNotFound())

		return 0, false
	}

	return id, true
}
