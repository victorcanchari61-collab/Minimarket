// Package terminals es Configuraciones › Terminales y series › Terminales POS:
// las cajas de cada tienda.
package terminals

import "time"

type Terminal struct {
	ID            int64
	BranchID      int64
	BranchName    string
	WarehouseID   *int64 // almacén del que descuenta lo que vende; nil = sin definir
	WarehouseName string
	Code          string
	Name          string
	Active        bool
	Series        int64 // cuántas series de comprobantes usa (solo el listado la calcula)
	CreatedAt     time.Time
}

// Input es lo que se guarda al crear o editar una terminal.
type Input struct {
	BranchID    int64
	WarehouseID *int64
	Code        string
	Name        string
	Active      bool
}

// BranchRef es una tienda donde se puede poner una caja.
type BranchRef struct {
	ID   int64
	Code string
	Name string
}

// WarehouseRef es un almacén que puede abastecer a una caja de su sucursal.
type WarehouseRef struct {
	ID       int64
	BranchID int64
	Name     string
}

// Filter son los filtros, el orden y el cursor del listado.
type Filter struct {
	Search   string // código o nombre (contiene, sin acentos)
	BranchID *int64
	Active   *bool
	Sort     string // code | name | status | created ("" = name)
	Desc     bool
	Cursor   string
	// Lo que la tabla no muestra no se calcula.
	SkipSeries bool
}

// Summary son las cifras de la cabecera de la pantalla.
type Summary struct {
	Active        int64
	Inactive      int64
	StoresWithout int64 // tiendas activas que todavía no tienen una caja activa
}
