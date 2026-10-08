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

// DocumentType es el tipo de documento de identidad. Es un enum.
type DocumentType string

const (
	DocumentDNI      DocumentType = "dni"
	DocumentCE       DocumentType = "ce"
	DocumentPassport DocumentType = "passport"
)

func (d DocumentType) Valid() bool {
	return d == DocumentDNI || d == DocumentCE || d == DocumentPassport
}

func (d DocumentType) Label() string {
	switch d {
	case DocumentDNI:
		return "DNI"
	case DocumentCE:
		return "Carné de extranjería"
	case DocumentPassport:
		return "Pasaporte"
	default:
		return string(d)
	}
}

type RoleRef struct {
	ID      int64
	Name    string
	IsAdmin bool // el rol Administrador: da acceso a todas las sucursales
}

type BranchRef struct {
	ID   int64
	Name string
	Kind string
}

type User struct {
	ID             int64
	Code           string // automático: USR-0001
	Name           string
	Email          string
	DocumentType   DocumentType // vacío si no tiene documento registrado
	DocumentNumber string
	Phone          string
	Position       string // cargo
	Status         Status
	AllBranches    bool // trabaja en toda la cadena
	Branches       []BranchRef
	Roles          []RoleRef
	LastLoginAt    *time.Time
	CreatedAt      time.Time
}

// Input es lo que se guarda al crear o editar un usuario. La contraseña solo
// cuenta al crear; después se cambia con ResetPassword.
type Input struct {
	Name           string
	Email          string
	Password       string
	DocumentType   DocumentType
	DocumentNumber string
	Phone          string
	Position       string
	Status         Status
	RoleIDs        []int64
	AllBranches    bool
	BranchIDs      []int64
}

// Filter son los filtros, el orden y el cursor del listado. Cada campo
// opcional vacío significa "sin filtro".
type Filter struct {
	Search string // nombre (contiene, sin acentos), correo, código o documento (contiene)
	RoleID *int64
	Status Status
	Sort   string // code | name | email | status | created ("" = name)
	Desc   bool
	Cursor string
}

// Summary son las cifras de la cabecera de la pantalla (los totales no salen
// del listado, que no cuenta filas).
type Summary struct {
	Active         int64
	Inactive       int64
	Administrators int64 // administradores activos
	WithoutRoles   int64
}
