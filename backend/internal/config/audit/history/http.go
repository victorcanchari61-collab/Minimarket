package history

import (
	"net/http"
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

// Routes: el historial solo se lee. «Ver» es el permiso de la pantalla.
func (h *Handler) Routes(api *gin.RouterGroup, can web.Guard) {
	view := can("config.audit.history.view")

	api.GET("/audit/history", view, h.List)
	api.GET("/audit/history/users", view, h.Users)
}

type listQuery struct {
	From      *time.Time `form:"from" time_format:"2006-01-02"`
	To        *time.Time `form:"to" time_format:"2006-01-02"`
	UserID    *int64     `form:"user_id" binding:"omitempty,gt=0"`
	Entity    string     `form:"entity" binding:"omitempty,max=100"`
	Action    string     `form:"action" binding:"omitempty,max=30"`
	Search    string     `form:"search" binding:"omitempty,min=2,max=100"`
	Direction string     `form:"direction" binding:"omitempty,oneof=asc desc"`
	Cursor    string     `form:"cursor" binding:"omitempty,max=500"`
}

type actionResource struct {
	ID        int64     `json:"id"`
	At        time.Time `json:"at"`
	UserID    *int64    `json:"user_id"`
	UserName  string    `json:"user_name"`
	UserEmail string    `json:"user_email"`
	Action    string    `json:"action"`
	Entity    string    `json:"entity"`
	EntityID  *int64    `json:"entity_id"`
	Label     string    `json:"label"`
	Method    string    `json:"method"`
	IP        string    `json:"ip"`
}

func resource(a Action) actionResource {
	return actionResource{
		ID: a.ID, At: a.At, UserID: a.UserID, UserName: a.UserName, UserEmail: a.UserEmail, Action: a.Action,
		Entity: a.Entity, EntityID: a.EntityID, Label: a.Label, Method: a.Method, IP: a.IP,
	}
}

// GET /api/audit/history — 20 líneas por petición, de la más reciente a la más
// antigua, dentro de un rango de fechas (por defecto, el último mes).
func (h *Handler) List(c *gin.Context) {
	var q listQuery
	if !web.BindQuery(c, &q) {
		return
	}

	fields, ok := web.BindFields[actionResource](c)
	if !ok {
		return
	}

	from, to, err := h.service.Range(q.From, q.To)
	if err != nil {
		_ = c.Error(err)

		return
	}

	page, err := h.service.List(c.Request.Context(), Filter{
		From: from, To: to, UserID: q.UserID, Entity: q.Entity, Action: q.Action, Search: q.Search,
		Desc: q.Direction != "asc", Cursor: q.Cursor,
	})
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]any, len(page.Data))
	for i, a := range page.Data {
		data[i] = web.Pick(resource(a), fields)
	}

	c.JSON(http.StatusOK, pagination.Page[any]{Data: data, Meta: page.Meta})
}

// GET /api/audit/history/users — las personas que aparecen en el historial.
func (h *Handler) Users(c *gin.Context) {
	users, err := h.service.Users(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]gin.H, len(users))
	for i, u := range users {
		data[i] = gin.H{"id": u.ID, "name": u.Name, "email": u.Email}
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}
