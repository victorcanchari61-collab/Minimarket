package series

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

func (h *Handler) Routes(api *gin.RouterGroup, can web.Guard) {
	view := can("config.terminals.series.view")

	api.GET("/document-series", view, h.List)
	api.POST("/document-series", can("config.terminals.series.create"), h.Create)
	api.GET("/document-series/summary", view, h.Summary) // antes de :id
	api.GET("/document-series/branches", view, h.Branches)
	api.GET("/document-series/terminals", view, h.Terminals)
	api.GET("/document-series/:id", view, h.Show)
	api.PUT("/document-series/:id", can("config.terminals.series.edit"), h.Update)
	api.DELETE("/document-series/:id", can("config.terminals.series.delete"), h.Delete)
}

type listQuery struct {
	Search     string `form:"search" binding:"omitempty,min=1,max=10"`
	BranchID   *int64 `form:"branch_id" binding:"omitempty,gt=0"`
	TerminalID *int64 `form:"terminal_id" binding:"omitempty,gt=0"`
	Type       string `form:"document_type" binding:"omitempty,oneof=invoice receipt credit_note debit_note dispatch_guide"`
	Status     string `form:"status" binding:"omitempty,oneof=active inactive"`
	Sort       string `form:"sort" binding:"omitempty,oneof=series type status created"`
	Direction  string `form:"direction" binding:"omitempty,oneof=asc desc"`
	Cursor     string `form:"cursor" binding:"omitempty,max=500"`
}

type seriesRequest struct {
	BranchID     int64  `json:"branch_id" binding:"required,gt=0"`
	TerminalID   *int64 `json:"terminal_id" binding:"omitempty,gt=0"`
	DocumentType string `json:"document_type" binding:"required,oneof=invoice receipt credit_note debit_note dispatch_guide"`
	Series       string `json:"series" binding:"required,max=10"`
	NextNumber   int64  `json:"next_number" binding:"omitempty,gte=1,lte=99999999"`
	Active       *bool  `json:"active"`
}

func (r seriesRequest) input() Input {
	active := true // una serie nueva arranca activa
	if r.Active != nil {
		active = *r.Active
	}

	return Input{
		BranchID: r.BranchID, TerminalID: r.TerminalID, Type: DocumentType(r.DocumentType),
		Series: r.Series, NextNumber: r.NextNumber, Active: active,
	}
}

type seriesResource struct {
	ID           int64     `json:"id"`
	BranchID     int64     `json:"branch_id"`
	BranchName   string    `json:"branch_name"`
	TerminalID   *int64    `json:"terminal_id"`
	TerminalName string    `json:"terminal_name"`
	DocumentType string    `json:"document_type"`
	Series       string    `json:"series"`
	NextNumber   int64     `json:"next_number"`
	Used         bool      `json:"used"`
	Active       bool      `json:"active"`
	CreatedAt    time.Time `json:"created_at"`
}

func resource(s Series) seriesResource {
	return seriesResource{
		ID: s.ID, BranchID: s.BranchID, BranchName: s.BranchName, TerminalID: s.TerminalID, TerminalName: s.TerminalName,
		DocumentType: string(s.Type), Series: s.Series, NextNumber: s.NextNumber, Used: s.Used(),
		Active: s.Active, CreatedAt: s.CreatedAt,
	}
}

// GET /api/document-series — 20 series por petición, paginadas por cursor.
func (h *Handler) List(c *gin.Context) {
	var q listQuery
	if !web.BindQuery(c, &q) {
		return
	}

	fields, ok := web.BindFields[seriesResource](c)
	if !ok {
		return
	}

	filter := Filter{
		Search: q.Search, BranchID: q.BranchID, TerminalID: q.TerminalID, Type: DocumentType(q.Type),
		Sort: q.Sort, Desc: q.Direction == "desc", Cursor: q.Cursor,
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
	for i, s := range page.Data {
		data[i] = web.Pick(resource(s), fields)
	}

	c.JSON(http.StatusOK, pagination.Page[any]{Data: data, Meta: page.Meta})
}

func (h *Handler) Show(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	item, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(item)})
}

func (h *Handler) Create(c *gin.Context) {
	var req seriesRequest
	if !web.Bind(c, &req) {
		return
	}

	item, err := h.service.Create(c.Request.Context(), req.input())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": resource(item)})
}

func (h *Handler) Update(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var req seriesRequest
	if !web.Bind(c, &req) {
		return
	}

	item, err := h.service.Update(c.Request.Context(), id, req.input())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(item)})
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

	c.JSON(http.StatusOK, gin.H{"message": "Serie eliminada."})
}

func (h *Handler) Summary(c *gin.Context) {
	summary, err := h.service.Summary(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"active": summary.Active, "inactive": summary.Inactive, "used": summary.Used,
	}})
}

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

func (h *Handler) Terminals(c *gin.Context) {
	terminals, err := h.service.Terminals(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]gin.H, len(terminals))
	for i, t := range terminals {
		data[i] = gin.H{"id": t.ID, "branch_id": t.BranchID, "code": t.Code, "name": t.Name}
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func idParam(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		_ = c.Error(seriesNotFound())

		return 0, false
	}

	return id, true
}
