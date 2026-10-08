package permissions

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/auth"
	"minimarket/backend/internal/pagination"
	"minimarket/backend/internal/web"
)

type requestAccessBody struct {
	Permission string `json:"permission" binding:"required,max=120"`
	Reason     string `json:"reason" binding:"omitempty,max=200"`
}

type rejectBody struct {
	Note string `json:"note" binding:"omitempty,max=200"`
}

type requestsQuery struct {
	Status string `form:"status" binding:"omitempty,oneof=pending approved rejected"`
	Cursor string `form:"cursor" binding:"omitempty,max=500"`
}

type requestResource struct {
	ID            int64      `json:"id"`
	UserID        int64      `json:"user_id"`
	UserCode      string     `json:"user_code"`
	UserName      string     `json:"user_name"`
	UserEmail     string     `json:"user_email"`
	Permission    string     `json:"permission"`
	Reason        string     `json:"reason"`
	Status        string     `json:"status"`
	StatusLabel   string     `json:"status_label"`
	DecidedByName string     `json:"decided_by_name"`
	DecidedAt     *time.Time `json:"decided_at"`
	DecisionNote  string     `json:"decision_note"`
	CreatedAt     time.Time  `json:"created_at"`
}

func requestOf(q Request) requestResource {
	return requestResource{
		ID: q.ID, UserID: q.UserID, UserCode: q.UserCode, UserName: q.UserName, UserEmail: q.UserEmail,
		Permission: q.Permission, Reason: q.Reason,
		Status: string(q.Status), StatusLabel: q.Status.Label(),
		DecidedByName: q.DecidedByName, DecidedAt: q.DecidedAt, DecisionNote: q.DecisionNote,
		CreatedAt: q.CreatedAt,
	}
}

// POST /api/access/requests — pide acceso a una acción (la hace quien no la tiene).
func (h *Handler) RequestAccess(c *gin.Context) {
	var req requestAccessBody
	if !web.Bind(c, &req) {
		return
	}

	request, err := h.service.RequestAccess(c.Request.Context(), auth.CurrentUser(c).ID, req.Permission, req.Reason)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": requestOf(request)})
}

// GET /api/access/requests — 20 solicitudes por petición, de la más reciente a la más antigua.
func (h *Handler) Requests(c *gin.Context) {
	var q requestsQuery
	if !web.BindQuery(c, &q) {
		return
	}

	fields, ok := web.BindFields[requestResource](c)
	if !ok {
		return
	}

	page, err := h.service.Requests(c.Request.Context(), RequestStatus(q.Status), q.Cursor)
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]any, len(page.Data))
	for i, request := range page.Data {
		data[i] = web.Pick(requestOf(request), fields)
	}

	c.JSON(http.StatusOK, pagination.Page[any]{Data: data, Meta: page.Meta})
}

// GET /api/access/requests/summary — cuántas esperan respuesta (la cifra de la pestaña).
func (h *Handler) PendingRequests(c *gin.Context) {
	n, err := h.service.PendingRequests(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"pending": n}})
}

func (h *Handler) Approve(c *gin.Context) {
	id, ok := idParam(c, requestNotFound)
	if !ok {
		return
	}

	request, err := h.service.Approve(c.Request.Context(), auth.CurrentUser(c).ID, id)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": requestOf(request)})
}

func (h *Handler) Reject(c *gin.Context) {
	id, ok := idParam(c, requestNotFound)
	if !ok {
		return
	}

	var body rejectBody
	if !web.Bind(c, &body) {
		return
	}

	request, err := h.service.Reject(c.Request.Context(), auth.CurrentUser(c).ID, id, body.Note)
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": requestOf(request)})
}
