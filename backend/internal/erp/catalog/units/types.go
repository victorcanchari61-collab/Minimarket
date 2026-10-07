// Package units es ERP › Catálogo y maestros › Unidades y presentaciones: las
// unidades de medida con las que se compra, se guarda y se vende.
package units

type Unit struct {
	ID           int64
	Name         string
	Abbreviation string
}
