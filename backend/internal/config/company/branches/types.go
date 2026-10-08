// Package branches es Configuraciones › Empresa y sucursales › Sucursales: los
// puntos físicos de la cadena (tiendas y centros de distribución).
package branches

import "time"

// Kind es el tipo de sucursal. Es un enum: nunca se usan cadenas sueltas
// ("store") fuera de este archivo.
type Kind string

const (
	KindStore        Kind = "store"        // vende al público
	KindDistribution Kind = "distribution" // abastece a las tiendas; no vende
)

func (k Kind) Valid() bool {
	return k == KindStore || k == KindDistribution
}

func (k Kind) Label() string {
	switch k {
	case KindStore:
		return "Tienda"
	case KindDistribution:
		return "Centro de distribución"
	default:
		return string(k)
	}
}

type Branch struct {
	ID        int64
	Code      string
	Name      string
	Address   string
	Phone     string
	SunatCode string // establecimiento anexo de SUNAT; vacío si no tiene
	Kind      Kind
	Active    bool
	// Cuántos almacenes y usuarios tiene (solo los llena el listado de administración).
	Warehouses int64
	Users      int64
	CreatedAt  time.Time
}

// Input es lo que se guarda al crear o editar una sucursal.
type Input struct {
	Code      string
	Name      string
	Address   string
	Phone     string
	SunatCode string
	Kind      Kind
	Active    bool
}

// Filter son los filtros, el orden y el cursor del listado de administración.
type Filter struct {
	Search string // código o nombre (contiene, sin acentos) o dirección
	Kind   Kind
	Active *bool
	Sort   string // code | name | kind | status | created ("" = name)
	Desc   bool
	Cursor string
}

// Summary son las cifras de la cabecera de la pantalla.
type Summary struct {
	Active       int64
	Inactive     int64
	Stores       int64
	Distribution int64
}
