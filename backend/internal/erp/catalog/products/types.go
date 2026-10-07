// Package products es ERP › Catálogo y maestros › Productos: el catálogo de
// productos y sus categorías.
package products

// ProductStatus es el estado de un producto. Es un enum: nunca se usan cadenas
// sueltas ("active") fuera de este archivo.
type ProductStatus string

const (
	StatusActive   ProductStatus = "active"
	StatusInactive ProductStatus = "inactive"
)

func (s ProductStatus) Valid() bool {
	return s == StatusActive || s == StatusInactive
}

func (s ProductStatus) Label() string {
	switch s {
	case StatusActive:
		return "Activo"
	case StatusInactive:
		return "Inactivo"
	default:
		return string(s)
	}
}

// Product es un producto del catálogo. El precio viaja como texto exacto
// ("24.90"): el dinero nunca pasa por float.
type Product struct {
	ID         int64
	SKU        string
	Name       string
	CategoryID *int64
	Category   *string
	UnitID     int64
	Unit       string
	Price      string
	Status     ProductStatus
}

// ProductInput es lo que se guarda al crear o editar un producto.
type ProductInput struct {
	SKU        string
	Name       string
	CategoryID *int64
	UnitID     int64
	Price      string
	Status     ProductStatus
}

type Category struct {
	ID   int64
	Name string
}

// Summary son las cifras de la cabecera de la pantalla (los totales no salen
// del listado, que no cuenta filas).
type Summary struct {
	Active     int64
	Inactive   int64
	Categories int64
}
