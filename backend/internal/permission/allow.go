package permission

import "strings"

// Grants son los permisos efectivos de un usuario: lo que le dan sus roles y lo
// que se le dio directamente (Allow), menos lo que se le quitó a él (Deny).
type Grants struct {
	// Superuser puede todo y no se le aplican denegaciones: es quien arranca el
	// sistema y administra los accesos.
	Superuser bool
	Allow     []string
	Deny      []string
}

// covers dice si una regla (un permiso dado o denegado en cualquier nivel del
// árbol) alcanza al permiso `code`.
func covers(rule, code string) bool {
	return rule == Root || rule == code || strings.HasPrefix(code, rule+".")
}

// submoduleOf devuelve el submódulo al que pertenece una acción.
func submoduleOf(action string) string {
	parts := strings.Split(action, ".")

	return strings.Join(parts[:3], ".")
}

func isView(code string) bool {
	return strings.HasSuffix(code, "."+ViewAction)
}

// Allows decide si los permisos `g` alcanzan para la acción `code`
// (por ejemplo "erp.catalog.products.edit").
//
// Reglas:
//   - Un permiso dado en un nivel alto incluye todo lo que cuelga de él.
//   - Cualquier acción de un submódulo implica poder verlo.
//   - Lo denegado le gana a lo permitido.
//   - Denegar "ver" un submódulo lo bloquea entero: no se puede actuar sobre lo
//     que no se puede ver. Denegar otra acción solo bloquea esa acción.
func (c *Catalog) Allows(g Grants, code string) bool {
	if !IsAction(code) || !c.Valid(code) {
		return false
	}

	if g.Superuser {
		return true
	}

	submodule := submoduleOf(code)

	for _, rule := range g.Deny {
		if covers(rule, code) {
			return false
		}

		if !isView(code) && covers(rule, submodule+"."+ViewAction) {
			return false
		}
	}

	for _, rule := range g.Allow {
		if covers(rule, code) {
			return true
		}

		// Tener cualquier acción del submódulo basta para verlo.
		if isView(code) && strings.HasPrefix(rule, submodule+".") {
			return true
		}
	}

	return false
}

// Effective expande los permisos de un usuario a la lista de acciones que
// puede hacer. Es lo que consume el frontend para mostrar u ocultar opciones.
func (c *Catalog) Effective(g Grants) []string {
	allowed := []string{}

	for _, action := range c.Actions() {
		if c.Allows(g, action) {
			allowed = append(allowed, action)
		}
	}

	return allowed
}
