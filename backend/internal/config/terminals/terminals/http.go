package terminals

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
	view := can("config.terminals.pos_terminals.view")

	api.GET("/terminals", view, h.List)
	api.POST("/terminals", can("config.terminals.pos_terminals.create"), h.Create)
	api.GET("/terminals/summary", view, h.Summary) // antes de :id
	api.GET("/terminals/branches", view, h.Branches)
	api.GET("/terminals/warehouses", view, h.Warehouses)
	api.GET("/terminals/:id", view, h.Show)
	api.PUT("/terminals/:id", can("config.terminals.pos_terminals.edit"), h.Update)
	api.DELETE("/terminals/:id", can("config.terminals.pos_terminals.delete"), h.Delete)
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

type terminalRequest struct {
	BranchID    int64  `json:"branch_id" binding:"required,gt=0"`
	WarehouseID *int64 `json:"warehouse_id" binding:"omitempty,gt=0"`
	Code        string `json:"code" binding:"required,max=15"`
	Name        string `json:"name" binding:"required,max=100"`
	Active      *bool  `json:"active"`
}

func (r terminalRequest) input() Input {
	active := true // una terminal nueva arranca activa
	if r.Active != nil {
		active = *r.Active
	}

	return Input{BranchID: r.BranchID, WarehouseID: r.WarehouseID, Code: r.Code, Name: r.Name, Active: active}
}

// --- salida -----------------------------------------------------------------

type terminalResource struct {
	ID            int64     `json:"id"`
	BranchID      int64     `json:"branch_id"`
	BranchName    string    `json:"branch_name"`
	WarehouseID   *int64    `json:"warehouse_id"`
	WarehouseName string    `json:"warehouse_name"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	Active        bool      `json:"active"`
	Series        int64     `json:"series"`
	CreatedAt     time.Time `json:"created_at"`
}

func resource(t Terminal) terminalResource {
	return terminalResource{
		ID: t.ID, BranchID: t.BranchID, BranchName: t.BranchName,
		WarehouseID: t.WarehouseID, WarehouseName: t.WarehouseName,
		Code: t.Code, Name: t.Name, Active: t.Active, Series: t.Series, CreatedAt: t.CreatedAt,
	}
}

// --- handlers ---------------------------------------------------------------

// GET /api/terminals — 20 terminales por petición, paginadas por cursor.
func (h *Handler) List(c *gin.Context) {
	var q listQuery
	if !web.BindQuery(c, &q) {
		return
	}

	fields, ok := web.BindFields[terminalResource](c)
	if !ok {
		return
	}

	filter := Filter{
		Search: q.Search, BranchID: q.BranchID, Sort: q.Sort, Desc: q.Direction == "desc", Cursor: q.Cursor,
		SkipSeries: !fields.Wants("series"),
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

	data := make([]any, len(page.Data))
	for i, t := range page.Data {
		data[i] = web.Pick(resource(t), fields)
	}

	c.JSON(http.StatusOK, pagination.Page[any]{Data: data, Meta: page.Meta})
}

func (h *Handler) Show(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	terminal, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(terminal)})
}

func (h *Handler) Create(c *gin.Context) {
	var req terminalRequest
	if !web.Bind(c, &req) {
		return
	}

	terminal, err := h.service.Create(c.Request.Context(), req.input())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": resource(terminal)})
}

func (h *Handler) Update(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var req terminalRequest
	if !web.Bind(c, &req) {
		return
	}

	terminal, err := h.service.Update(c.Request.Context(), id, req.input())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(terminal)})
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

	c.JSON(http.StatusOK, gin.H{"message": "Terminal eliminada."})
}

func (h *Handler) Summary(c *gin.Context) {
	summary, err := h.service.Summary(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"active":         summary.Active,
		"inactive":       summary.Inactive,
		"stores_without": summary.StoresWithout,
	}})
}

// GET /api/terminals/branches — las tiendas donde se puede poner una caja.
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

// GET /api/terminals/warehouses — los almacenes que pueden abastecer a una caja.
func (h *Handler) Warehouses(c *gin.Context) {
	warehouses, err := h.service.Warehouses(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]gin.H, len(warehouses))
	for i, w := range warehouses {
		data[i] = gin.H{"id": w.ID, "branch_id": w.BranchID, "name": w.Name}
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// idParam lee :id; un id que no es número se trata como "no existe".
func idParam(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		_ = c.Error(terminalNotFound())

		return 0, false
	}

	return id, true
}
