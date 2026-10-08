// Package permission es el control de acceso: el catálogo de TODOS los permisos
// del sistema, la regla que decide si un usuario puede hacer algo, y el
// middleware que la exige en cada ruta.
//
// Los permisos forman un árbol de cuatro niveles y se pueden dar en cualquiera:
//
//	erp                                  todo el sistema ERP
//	erp.catalog                          todo el módulo Catálogo y maestros
//	erp.catalog.products                 todo el submódulo Productos
//	erp.catalog.products.edit            una acción concreta
//
// "*" es la raíz: todo, incluido lo que se agregue después.
package permission

import (
	"fmt"
	"strings"
)

// Root es el permiso que lo incluye todo.
const Root = "*"

// ViewAction es la acción de solo mirar. Todo submódulo la tiene y cualquier
// otra acción la implica: no se puede editar lo que no se puede ver.
const ViewAction = "view"

// Action es algo que se puede hacer en un submódulo, además de verlo.
type Action struct{ Code, Label string }

type Submodule struct {
	Code    string
	Label   string
	Actions []Action
}

type Module struct {
	Code       string
	Label      string
	Submodules []Submodule
}

type System struct {
	Code    string
	Label   string
	Modules []Module
}

// Acciones de uso común. Cada submódulo declara las que de verdad tiene: un
// reporte solo se exporta, una orden de compra se aprueba y se envía, una caja
// se abre y se cierra.
var (
	Create          = Action{"create", "Crear"}
	Edit            = Action{"edit", "Editar"}
	Delete          = Action{"delete", "Eliminar"}
	Approve         = Action{"approve", "Aprobar"}
	Request         = Action{"request", "Solicitar"}
	Schedule        = Action{"schedule", "Programar"}
	Cancel          = Action{"cancel", "Anular"}
	Send            = Action{"send", "Enviar"}
	Resend          = Action{"resend", "Reenviar"}
	Receive         = Action{"receive", "Recibir"}
	Export          = Action{"export", "Exportar"}
	Open            = Action{"open", "Abrir"}
	Close           = Action{"close", "Cerrar"}
	Reconcile       = Action{"reconcile", "Conciliar"}
	Calculate       = Action{"calculate", "Calcular"}
	Generate        = Action{"generate", "Generar"}
	Register        = Action{"register", "Registrar"}
	RegisterPayment = Action{"register_payment", "Registrar pagos"}
	Resolve         = Action{"resolve", "Resolver"}
	Confirm         = Action{"confirm", "Confirmar"}
	Assign          = Action{"assign", "Asignar"}
	Publish         = Action{"publish", "Publicar"}
	Adjust          = Action{"adjust", "Ajustar"}
	Test            = Action{"test", "Probar"}
	Discount        = Action{"discount", "Aplicar descuentos"}
	Resume          = Action{"resume", "Retomar"}
	Evaluate        = Action{"evaluate", "Evaluar"}
	ResetPassword   = Action{"reset_password", "Reiniciar contraseña"}
)

// CRUD es lo habitual de una tabla maestra.
var CRUD = []Action{Create, Edit, Delete}

func sub(code, label string, actions ...Action) Submodule {
	return Submodule{Code: code, Label: label, Actions: actions}
}

func mod(code, label string, subs ...Submodule) Module {
	return Module{Code: code, Label: label, Submodules: subs}
}

func sys(code, label string, mods ...Module) System {
	return System{Code: code, Label: label, Modules: mods}
}

// Catalog indexa todos los permisos válidos.
type Catalog struct {
	Systems []System
	known   map[string]bool
}

// DefaultCatalog es el catálogo de la suite completa.
func DefaultCatalog() *Catalog {
	return NewCatalog(erp(), pos(), mdm(), scm(), wms(), tms(), hcm(), crm(), bi(), configSystem())
}

// NewCatalog arma el índice. Un código repetido es un error de quien escribió
// el catálogo y se detecta al arrancar, no en producción.
func NewCatalog(systems ...System) *Catalog {
	c := &Catalog{Systems: systems, known: map[string]bool{}}

	add := func(code string) {
		if c.known[code] {
			panic(fmt.Sprintf("permission: código repetido en el catálogo: %s", code))
		}

		c.known[code] = true
	}

	for _, s := range systems {
		add(s.Code)

		for _, m := range s.Modules {
			add(s.Code + "." + m.Code)

			for _, sm := range m.Submodules {
				base := s.Code + "." + m.Code + "." + sm.Code
				add(base)
				add(base + "." + ViewAction)

				for _, a := range sm.Actions {
					add(base + "." + a.Code)
				}
			}
		}
	}

	return c
}

// Valid dice si un código existe en el catálogo ("*" también).
func (c *Catalog) Valid(code string) bool {
	return code == Root || c.known[code]
}

// IsAction dice si el código es una acción concreta (cuatro niveles).
func IsAction(code string) bool {
	return strings.Count(code, ".") == 3
}

// Actions devuelve el código de TODAS las acciones del catálogo, incluida "ver".
func (c *Catalog) Actions() []string {
	var out []string

	for _, s := range c.Systems {
		for _, m := range s.Modules {
			for _, sm := range m.Submodules {
				base := s.Code + "." + m.Code + "." + sm.Code
				out = append(out, base+"."+ViewAction)

				for _, a := range sm.Actions {
					out = append(out, base+"."+a.Code)
				}
			}
		}
	}

	return out
}
