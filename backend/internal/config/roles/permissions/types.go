// Package permissions es Configuraciones › Roles y permisos › Permisos por
// sistema: quién puede hacer qué, visto por rol y por persona, y las
// solicitudes de acceso que la gente hace al toparse con una pantalla cerrada.
//
// No confundir con internal/permission, que es la regla que se aplica en cada
// ruta; aquí se administran los datos que esa regla lee.
package permissions

import (
	"context"
	"time"
)

// Rules es lo que este paquete necesita saber del catálogo de permisos. Lo
// entrega quien arma el submódulo (server) para no depender del otro paquete.
type Rules struct {
	// Valid dice si un código existe en el catálogo ("*" incluido).
	Valid func(code string) bool
	// IsAction dice si el código es una acción concreta (cuatro niveles).
	IsAction func(code string) bool
	// Allows dice si el usuario ya puede hacer esa acción.
	Allows func(ctx context.Context, userID int64, code string) (bool, error)
}

// AdminCode es el código del rol Administrador: acceso total, intocable.
const AdminCode = "admin"

type RoleRef struct {
	ID   int64
	Name string
}

// RoleAccess es un rol con los permisos que da.
type RoleAccess struct {
	ID          int64
	Name        string
	Description string
	IsSystem    bool
	UserCount   int64
	Permissions []string
}

// Person es un usuario visto desde sus accesos.
type Person struct {
	ID      int64
	Code    string
	Name    string
	Email   string
	Active  bool
	IsAdmin bool
	Roles   []string // nombres
}

// PersonAccess es lo que puede una persona y de dónde le viene: lo que dan
// sus roles, más lo que se le dio o se le quitó a ella directamente.
type PersonAccess struct {
	Person          Person
	Roles           []RoleRef
	RolePermissions []string
	Allow           []string
	Deny            []string
}

// RequestStatus es el estado de una solicitud. Es un enum.
type RequestStatus string

const (
	RequestPending  RequestStatus = "pending"
	RequestApproved RequestStatus = "approved"
	RequestRejected RequestStatus = "rejected"
)

func (s RequestStatus) Valid() bool {
	return s == RequestPending || s == RequestApproved || s == RequestRejected
}

func (s RequestStatus) Label() string {
	switch s {
	case RequestPending:
		return "Pendiente"
	case RequestApproved:
		return "Aprobada"
	case RequestRejected:
		return "Rechazada"
	default:
		return string(s)
	}
}

type Request struct {
	ID            int64
	UserID        int64
	UserCode      string
	UserName      string
	UserEmail     string
	Permission    string
	Reason        string
	Status        RequestStatus
	DecidedByName string
	DecidedAt     *time.Time
	DecisionNote  string
	CreatedAt     time.Time
}
