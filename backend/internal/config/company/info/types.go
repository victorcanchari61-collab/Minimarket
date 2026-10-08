// Package info es Configuraciones › Empresa y sucursales › Datos de la empresa:
// la razón social, el RUC y los datos que salen en los comprobantes.
package info

import "time"

// Company es la empresa. Hoy hay una; la tabla admite varias.
type Company struct {
	ID            int64
	RUC           string // vacío mientras no se registre
	LegalName     string // razón social
	TradeName     string // nombre comercial
	FiscalAddress string
	Phone         string
	Email         string
	UpdatedAt     time.Time
}

// Input es lo que se guarda al editar los datos.
type Input struct {
	RUC           string
	LegalName     string
	TradeName     string
	FiscalAddress string
	Phone         string
	Email         string
}
