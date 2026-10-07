package products

import (
	"net/http"
	"strconv"

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

// Routes registra las rutas del catálogo en un grupo que ya exige sesión.
func (h *Handler) Routes(api *gin.RouterGroup) {
	catalog := api.Group("/catalog")

	catalog.GET("/products", h.List)
	catalog.POST("/products", h.Create)
	catalog.GET("/products/summary", h.Summary) // antes de :id
	catalog.GET("/products/:id", h.Show)
	catalog.PUT("/products/:id", h.Update)
	catalog.DELETE("/products/:id", h.Delete)
	catalog.GET("/categories", h.Categories)
}

// --- entrada ----------------------------------------------------------------

type listQuery struct {
	Search     string `form:"search" binding:"omitempty,min=2,max=100"`
	SKU        string `form:"sku" binding:"omitempty,max=60"`
	Name       string `form:"name" binding:"omitempty,max=200"`
	CategoryID *int64 `form:"category_id" binding:"omitempty,gt=0"`
	Status     string `form:"status" binding:"omitempty,oneof=active inactive"`
	PriceFrom  string `form:"price_from" binding:"omitempty,max=20"`
	PriceTo    string `form:"price_to" binding:"omitempty,max=20"`
	Sort       string `form:"sort" binding:"omitempty,oneof=sku name price status"`
	Direction  string `form:"direction" binding:"omitempty,oneof=asc desc"`
	Cursor     string `form:"cursor" binding:"omitempty,max=500"`
}

type productRequest struct {
	SKU        string `json:"sku" binding:"required,max=60"`
	Name       string `json:"name" binding:"required,max=200"`
	CategoryID *int64 `json:"category_id" binding:"omitempty,gt=0"`
	UnitID     int64  `json:"unit_id" binding:"required,gt=0"`
	Price      string `json:"price" binding:"required,max=20"`
	Status     string `json:"status" binding:"omitempty,oneof=active inactive"`
}

func (r productRequest) input() ProductInput {
	return ProductInput{
		SKU:        r.SKU,
		Name:       r.Name,
		CategoryID: r.CategoryID,
		UnitID:     r.UnitID,
		Price:      r.Price,
		Status:     ProductStatus(r.Status),
	}
}

// --- salida -----------------------------------------------------------------

type productResource struct {
	ID          int64   `json:"id"`
	SKU         string  `json:"sku"`
	Name        string  `json:"name"`
	CategoryID  *int64  `json:"category_id"`
	Category    *string `json:"category"`
	UnitID      int64   `json:"unit_id"`
	Unit        string  `json:"unit"`
	Price       string  `json:"price"`
	Status      string  `json:"status"`
	StatusLabel string  `json:"status_label"`
}

func resource(p Product) productResource {
	return productResource{
		ID: p.ID, SKU: p.SKU, Name: p.Name,
		CategoryID: p.CategoryID, Category: p.Category,
		UnitID: p.UnitID, Unit: p.Unit,
		Price: p.Price, Status: string(p.Status), StatusLabel: p.Status.Label(),
	}
}

// --- handlers ---------------------------------------------------------------

// GET /api/catalog/products — 20 productos por petición, paginados por cursor.
func (h *Handler) List(c *gin.Context) {
	var q listQuery
	if !web.BindQuery(c, &q) {
		return
	}

	page, err := h.service.List(c.Request.Context(), ProductFilter{
		Search:     q.Search,
		SKU:        q.SKU,
		Name:       q.Name,
		CategoryID: q.CategoryID,
		Status:     ProductStatus(q.Status),
		PriceFrom:  q.PriceFrom,
		PriceTo:    q.PriceTo,
		Sort:       q.Sort,
		Desc:       q.Direction == "desc",
		Cursor:     q.Cursor,
	})
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]productResource, len(page.Data))
	for i, p := range page.Data {
		data[i] = resource(p)
	}

	c.JSON(http.StatusOK, pagination.Page[productResource]{Data: data, Meta: page.Meta})
}

func (h *Handler) Show(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	product, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(product)})
}

func (h *Handler) Create(c *gin.Context) {
	var req productRequest
	if !web.Bind(c, &req) {
		return
	}

	product, err := h.service.Create(c.Request.Context(), req.input())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": resource(product)})
}

func (h *Handler) Update(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var req productRequest
	if !web.Bind(c, &req) {
		return
	}

	product, err := h.service.Update(c.Request.Context(), id, req.input())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(product)})
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

	c.JSON(http.StatusOK, gin.H{"message": "Producto eliminado."})
}

func (h *Handler) Summary(c *gin.Context) {
	summary, err := h.service.Summary(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"active":     summary.Active,
		"inactive":   summary.Inactive,
		"categories": summary.Categories,
	}})
}

func (h *Handler) Categories(c *gin.Context) {
	categories, err := h.service.Categories(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]gin.H, len(categories))
	for i, category := range categories {
		data[i] = gin.H{"id": category.ID, "name": category.Name}
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// idParam lee :id; un id que no es número se trata como "no existe".
func idParam(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		_ = c.Error(productNotFound())

		return 0, false
	}

	return id, true
}
