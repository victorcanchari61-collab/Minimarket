// Package audit guarda el historial de acciones: quién hizo qué, cuándo y desde
// dónde. Solo registra; leerlo es del submódulo Auditoría › Historial de acciones.
//
// Se registra el hecho, nunca el contenido: ni cuerpos de petición ni
// contraseñas, solo el tipo de acción, el registro tocado y un nombre legible.
package audit

// Acciones del historial. Las de login se registran fuera del grupo protegido.
const (
	ActionCreate        = "create"
	ActionUpdate        = "update"
	ActionDelete        = "delete"
	ActionApprove       = "approve"
	ActionReject        = "reject"
	ActionResetPassword = "reset_password"
	ActionLogin         = "login"
	ActionLoginFailed   = "login_failed"
	ActionLogout        = "logout"
)

// Actor es quien hizo la petición.
type Actor struct {
	ID    int64
	Name  string
	Email string
}

// Entry es una línea del historial.
type Entry struct {
	Actor    *Actor // nil = nadie identificado (un intento de login fallido)
	Email    string // el correo escrito en un login fallido
	Action   string
	Entity   string
	EntityID *int64
	Label    string
	Method   string
	Path     string
	Status   int
	IP       string
}
