// Package history es Configuraciones › Auditoría › Historial de acciones: la
// lectura del registro que escribe internal/audit. Solo se consulta; nadie lo edita.
package history

import "time"

// Action es una línea del historial.
type Action struct {
	ID        int64
	At        time.Time
	UserID    *int64
	UserName  string
	UserEmail string
	Action    string
	Entity    string
	EntityID  *int64
	Label     string
	Method    string
	IP        string
}

// UserRef es una persona que aparece en el filtro de «quién».
type UserRef struct {
	ID    int64
	Name  string
	Email string
}

// Filter son los filtros y el cursor del listado. Siempre se lee de lo más
// reciente a lo más antiguo, y siempre dentro de un rango de fechas.
type Filter struct {
	From   time.Time // incluido
	To     time.Time // excluido
	UserID *int64
	Entity string
	Action string
	Search string // el nombre del registro o de quien lo hizo (contiene, sin acentos)
	Desc   bool   // más reciente primero (lo normal)
	Cursor string
}
