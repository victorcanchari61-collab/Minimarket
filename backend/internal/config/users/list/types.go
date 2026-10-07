// Package list es Configuraciones › Usuarios › Lista de usuarios: quién puede
// entrar al sistema y con qué roles.
package list

import "time"

// Status es el estado de un usuario. Es un enum: nunca se usan cadenas sueltas
// ("active") fuera de este archivo. Un usuario inactivo conserva su historial
// pero no puede iniciar sesión.
type Status string

const (
	StatusActive   Status = "active"
	StatusInactive Status = "inactive"
)

func (s Status) Valid() bool {
	return s == StatusActive || s == StatusInactive
}

func (s Status) Label() string {
	switch s {
	case StatusActive:
		return "Activo"
	case StatusInactive:
		return "Inactivo"
	default:
		return string(s)
	}
}

type RoleRef struct {
	ID   int64
	Name string
}

type User struct {
	ID        int64
	Name      string
	Email     string
	Status    Status
	Roles     []RoleRef
	CreatedAt time.Time
}

// Input es lo que se guarda al crear o editar un usuario. La contraseña solo
// cuenta al crear; después se cambia con ResetPassword.
type Input struct {
	Name     string
	Email    string
	Password string
	Status   Status
	RoleIDs  []int64
}

// Filter son los filtros, el orden y el cursor del listado. Cada campo
// opcional vacío significa "sin filtro".
type Filter struct {
	Search string // nombre (contiene, sin acentos) o correo (contiene)
	RoleID *int64
	Status Status
	Sort   string // name | email | status | created ("" = name)
	Desc   bool
	Cursor string
}

// Summary son las cifras de la cabecera de la pantalla (los totales no salen
// del listado, que no cuenta filas).
type Summary struct {
	Active   int64
	Inactive int64
}
