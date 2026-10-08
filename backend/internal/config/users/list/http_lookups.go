package list

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func (h *Handler) Summary(c *gin.Context) {
	summary, err := h.service.Summary(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"active":         summary.Active,
		"inactive":       summary.Inactive,
		"administrators": summary.Administrators,
		"without_roles":  summary.WithoutRoles,
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
		data[i] = roleResource{ID: r.ID, Name: r.Name, IsAdmin: r.IsAdmin}
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// GET /api/users/branches — las sucursales que se pueden asignar.
func (h *Handler) Branches(c *gin.Context) {
	branches, err := h.service.Branches(c.Request.Context())
	if err != nil {
		_ = c.Error(err)

		return
	}

	data := make([]branchResource, len(branches))
	for i, b := range branches {
		data[i] = branchResource{ID: b.ID, Name: b.Name, Kind: b.Kind}
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
