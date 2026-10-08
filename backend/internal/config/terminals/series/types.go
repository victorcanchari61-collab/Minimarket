// Package series es Configuraciones › Terminales y series › Series de
// comprobantes: la numeración (F001-00000123) de cada tipo de comprobante.
package series

import "time"

// DocumentType es el tipo de comprobante que numera una serie.
type DocumentType string

const (
	Invoice       DocumentType = "invoice"        // Factura
	Receipt       DocumentType = "receipt"        // Boleta de venta
	CreditNote    DocumentType = "credit_note"    // Nota de crédito
	DebitNote     DocumentType = "debit_note"     // Nota de débito
	DispatchGuide DocumentType = "dispatch_guide" // Guía de remisión
)

// Prefixes son las letras con las que puede empezar la serie de cada tipo (SUNAT).
// Las notas llevan la letra del comprobante que corrigen.
func (d DocumentType) Prefixes() string {
	switch d {
	case Invoice:
		return "F"
	case Receipt:
		return "B"
	case CreditNote, DebitNote:
		return "FB"
	case DispatchGuide:
		return "TV"
	default:
		return ""
	}
}

func (d DocumentType) Valid() bool { return d.Prefixes() != "" }

type Series struct {
	ID           int64
	BranchID     int64
	BranchName   string
	TerminalID   *int64
	TerminalName string
	Type         DocumentType
	Series       string
	NextNumber   int64
	Active       bool
	CreatedAt    time.Time
}

// Used dice si la serie ya emitió comprobantes: desde ahí no se puede cambiar
// ni borrar, solo desactivar.
func (s Series) Used() bool { return s.NextNumber > 1 }

// Input es lo que se guarda al crear o editar una serie. NextNumber solo cuenta
// al crear: después lo mueve el sistema al emitir.
type Input struct {
	BranchID   int64
	TerminalID *int64
	Type       DocumentType
	Series     string
	NextNumber int64
	Active     bool
}

type BranchRef struct {
	ID   int64
	Code string
	Name string
}

type TerminalRef struct {
	ID       int64
	BranchID int64
	Code     string
	Name     string
}

type Filter struct {
	Search     string // la serie (contiene)
	BranchID   *int64
	TerminalID *int64
	Type       DocumentType
	Active     *bool
	Sort       string // series | type | status | created ("" = series)
	Desc       bool
	Cursor     string
}

type Summary struct {
	Active   int64
	Inactive int64
	Used     int64 // series que ya emitieron comprobantes
}
