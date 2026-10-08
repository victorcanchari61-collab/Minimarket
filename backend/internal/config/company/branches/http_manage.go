package branches

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/pagination"
	"minimarket/backend/internal/web"
)

// --- entrada ----------------------------------------------------------------

type listQuery struct {
	Search    string `form:"search" binding:"omitempty,min=2,max=100"`
	Kind      string `form:"kind" binding:"omitempty,oneof=store distribution"`
	Status    string `form:"status" binding:"omitempty,oneof=active inactive"`
	Sort      string `form:"sort" binding:"omitempty,oneof=code name kind status created"`
	Direction string `form:"direction" binding:"omitempty,oneof=asc desc"`
	Cursor    string `form:"cursor" binding:"omitempty,max=500"`
}

type branchRequest struct {
	Code      string `json:"code" binding:"required,max=10"`
	Name      string `json:"name" binding:"required,max=100"`
	Address   string `json:"address" binding:"omitempty,max=200"`
	Phone     string `json:"phone" binding:"omitempty,max=20"`
	SunatCode string `json:"sunat_code" binding:"omitempty,max=4"`
	Kind      string `json:"kind" binding:"omitempty,oneof=store distribution"`
	Active    *bool  `json:"active"`
}

func (r branchRequest) input() Input {
	active := true // una sucursal nueva arranca activa
	if r.Active != nil {
		active = *r.Active
	}

	return Input{
		Code: r.Code, Name: r.Name, Address: r.Address, Phone: r.Phone,
		SunatCode: r.SunatCode, Kind: Kind(r.Kind), Active: active,
	}
}

// --- salida -----------------------------------------------------------------

type managedResource struct {
	ID         int64     `json:"id"`
	Code       string    `json:"code"`
	Name       string    `json:"name"`
	Address    string    `json:"address"`
	Phone      string    `json:"phone"`
	SunatCode  string    `json:"sunat_code"`
	Kind       string    `json:"kind"`
	KindLabel  string    `json:"kind_label"`
	Active     bool      `json:"active"`
	Warehouses int64     `json:"warehouses"`
	Users      int64     `json:"users"`
	CreatedAt  time.Time `json:"created_at"`
}

func managed(b Branch) managedResource {
	return managedResource{
		ID: b.ID, Code: b.Code, Name: b.Name, Address: b.Address, Phone: b.Phone,
		SunatCode: b.SunatCode, Kind: string(b.Kind), KindLabel: b.Kind.Label(), Active: b.Active,
		Warehouses: b.Warehouses, Users: b.Users, CreatedAt: b.CreatedAt,
	}
}

// --- handlers ---------------------------------------------------------------

// GET /api/branches — 20 sucursales por petición, paginadas por cursor.
func (h *Handler) Page(c *gin.Context) {
	var q listQuery
	if !web.BindQuery(c, &q) {
		return
	}

	filter := Filter{
		Search: q.Search, Kind: Kind(q.Kind), Sort: q.Sort, Desc: q.Direction == "desc", Cursor: q.Cursor,
	}

	if q.Status != "" {
		active := q.Status == "active"
		filter.Active = &active
	}

	page, err := h.service.Page(c.Request.Context(), filter)
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]managedResource, len(page.Data))
	for i, b := range page.Data {
		data[i] = managed(b)
	}

	c.JSON(http.StatusOK, pagination.Page[managedResource]{Data: data, Meta: page.Meta})
}

func (h *Handler) Show(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	branch, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": managed(branch)})
}

func (h *Handler) Create(c *gin.Context) {
	var req branchRequest
	if !web.Bind(c, &req) {
		return
	}

	branch, err := h.service.Create(c.Request.Context(), req.input())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": managed(branch)})
}

func (h *Handler) Update(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var req branchRequest
	if !web.Bind(c, &req) {
		return
	}

	branch, err := h.service.Update(c.Request.Context(), id, req.input())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": managed(branch)})
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

	c.JSON(http.StatusOK, gin.H{"message": "Sucursal eliminada."})
}

func (h *Handler) Summary(c *gin.Context) {
	summary, err := h.service.Summary(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"active":       summary.Active,
		"inactive":     summary.Inactive,
		"stores":       summary.Stores,
		"distribution": summary.Distribution,
	}})
}

// idParam lee :id; un id que no es número se trata como "no existe".
func idParam(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		_ = c.Error(branchNotFound())

		return 0, false
	}

	return id, true
}
