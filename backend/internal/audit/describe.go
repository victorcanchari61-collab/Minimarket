package audit

import "strings"

// verbs son los tramos finales de una ruta que nombran una acción en lugar de
// un subrecurso: POST /access/requests/:id/approve aprueba, no "crea".
var verbs = map[string]string{
	"approve":  ActionApprove,
	"reject":   ActionReject,
	"password": ActionResetPassword,
}

// Describe deduce qué se hizo a partir del método y de la ruta registrada
// ("/api/users/:id/password"): el registro tocado ("users") y la acción.
func Describe(method, pattern string) (entity, action string) {
	path := strings.Trim(strings.TrimPrefix(pattern, "/api"), "/")
	if path == "logout" {
		return "session", ActionLogout
	}

	var resource, trailing []string

	seenParam := false

	for _, segment := range strings.Split(path, "/") {
		switch {
		case segment == "":
		case strings.HasPrefix(segment, ":"):
			seenParam = true
		case seenParam:
			trailing = append(trailing, segment)
		default:
			resource = append(resource, segment)
		}
	}

	action = byMethod(method)

	if len(trailing) > 0 {
		last := trailing[len(trailing)-1]
		if verb, ok := verbs[last]; ok {
			action = verb
		} else {
			resource = append(resource, trailing...)
		}
	}

	if len(resource) == 0 {
		return "other", action
	}

	return strings.Join(resource, "/"), action
}

func byMethod(method string) string {
	switch method {
	case "POST":
		return ActionCreate
	case "DELETE":
		return ActionDelete
	default:
		return ActionUpdate
	}
}
