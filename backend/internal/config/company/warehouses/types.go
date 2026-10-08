// Package warehouses es Configuraciones › Empresa y sucursales › Almacenes: los
// almacenes de cada sucursal. Una sucursal puede tener varios.
package warehouses

import "time"

type Warehouse struct {
	ID         int64
	BranchID   int64
	BranchName string
	Code       string
	Name       string
	Address    string
	Active     bool
	CreatedAt  time.Time
}

// Input es lo que se guarda al crear o editar un almacén.
type Input struct {
	BranchID int64
	Code     string
	Name     string
	Address  string
	Active   bool
}

// BranchRef es una sucursal en la que se puede poner un almacén.
type BranchRef struct {
	ID   int64
	Code string
	Name string
}

// Filter son los filtros, el orden y el cursor del listado.
type Filter struct {
	Search   string // código o nombre (contiene, sin acentos)
	BranchID *int64
	Active   *bool
	Sort     string // code | name | status | created ("" = name)
	Desc     bool
	Cursor   string
}

// Summary son las cifras de la cabecera de la pantalla.
type Summary struct {
	Active          int64
	Inactive        int64
	BranchesWithout int64 // sucursales activas que todavía no tienen almacén
}
