package info

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

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

// Routes registra las rutas en un grupo que ya exige sesión.
func (h *Handler) Routes(api *gin.RouterGroup, can web.Guard) {
	api.GET("/company", can("config.company.info.view"), h.Show)
	api.PUT("/company", can("config.company.info.edit"), h.Update)
}

type companyRequest struct {
	RUC           string `json:"ruc" binding:"omitempty,max=11"`
	LegalName     string `json:"legal_name" binding:"required,max=200"`
	TradeName     string `json:"trade_name" binding:"omitempty,max=200"`
	FiscalAddress string `json:"fiscal_address" binding:"omitempty,max=250"`
	Phone         string `json:"phone" binding:"omitempty,max=20"`
	Email         string `json:"email" binding:"omitempty,max=255"`
}

type companyResource struct {
	ID            int64     `json:"id"`
	RUC           string    `json:"ruc"`
	LegalName     string    `json:"legal_name"`
	TradeName     string    `json:"trade_name"`
	FiscalAddress string    `json:"fiscal_address"`
	Phone         string    `json:"phone"`
	Email         string    `json:"email"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func resource(c Company) companyResource {
	return companyResource{
		ID: c.ID, RUC: c.RUC, LegalName: c.LegalName, TradeName: c.TradeName,
		FiscalAddress: c.FiscalAddress, Phone: c.Phone, Email: c.Email, UpdatedAt: c.UpdatedAt,
	}
}

// GET /api/company
func (h *Handler) Show(c *gin.Context) {
	company, err := h.service.Get(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(company)})
}

// PUT /api/company
func (h *Handler) Update(c *gin.Context) {
	var req companyRequest
	if !web.Bind(c, &req) {
		return
	}

	company, err := h.service.Update(c.Request.Context(), Input{
		RUC: req.RUC, LegalName: req.LegalName, TradeName: req.TradeName,
		FiscalAddress: req.FiscalAddress, Phone: req.Phone, Email: req.Email,
	})
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resource(company)})
}
