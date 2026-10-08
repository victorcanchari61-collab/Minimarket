// Package roles es Configuraciones › Roles y permisos › Roles: los conjuntos de
// permisos que se le dan a los usuarios ("Vendedor", "Almacenero"…).
package roles

import "time"

// AdminCode es el código del rol Administrador. Tiene acceso total, no se
// edita y no se elimina: es con lo que siempre se puede volver a entrar.
const AdminCode = "admin"

type Role struct {
	ID          int64
	Code        string // solo los roles del sistema lo tienen
	Name        string
	Description string
	Permissions []string // "erp", "erp.catalog.products.edit"…
	UserCount   int64
	CreatedAt   time.Time
}

// IsSystem dice si es un rol del sistema (no editable).
func (r Role) IsSystem() bool { return r.Code != "" }

// Input es lo que se guarda al crear o editar un rol.
type Input struct {
	Name        string
	Description string
	Permissions []string
}

// Filter son los filtros, el orden y el cursor del listado.
type Filter struct {
	Search string // nombre (contiene, sin acentos)
	Sort   string // name | created ("" = name)
	Desc   bool
	Cursor string
	// Lo que la tabla no muestra no se calcula.
	SkipPermissions bool
	SkipUserCount   bool
}
