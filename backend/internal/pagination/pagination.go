// Package pagination implementa la regla de los listados: MÁXIMO 20 filas por
// petición y paginación por cursor (keyset), nunca por número de página.
//
// El cliente envía el cursor tal cual lo recibió; no lo construye ni lo
// interpreta. Sin cursor se devuelven las primeras 20 filas.
package pagination

import (
	"encoding/base64"
	"encoding/json"
	"errors"
)

// PageSize es el límite de filas por petición. El cliente puede pedir menos,
// nunca más.
const PageSize = 20

var ErrInvalidCursor = errors.New("cursor inválido")

// Meta sigue el formato del listado acordado con el frontend.
type Meta struct {
	PerPage    int     `json:"per_page"`
	NextCursor *string `json:"next_cursor"`
	PrevCursor *string `json:"prev_cursor"`
}

// Page es la respuesta de cualquier listado.
type Page[T any] struct {
	Data []T  `json:"data"`
	Meta Meta `json:"meta"`
}

// Limit devuelve cuántas filas pedir a la base de datos: PageSize + 1. La fila
// de más solo sirve para saber si hay otra página sin hacer COUNT(*).
func Limit() int {
	return PageSize + 1
}

// Build recorta la fila sobrante y arma la página. `cursorOf` entrega el cursor
// de la ÚLTIMA fila devuelta (los valores por los que se ordena, con el id como
// desempate).
func Build[T any](rows []T, cursorOf func(last T) any) (Page[T], error) {
	page := Page[T]{Data: rows, Meta: Meta{PerPage: PageSize}}

	if len(rows) > PageSize {
		page.Data = rows[:PageSize]

		token, err := Encode(cursorOf(page.Data[PageSize-1]))
		if err != nil {
			return Page[T]{}, err
		}

		page.Meta.NextCursor = &token
	}

	if page.Data == nil {
		page.Data = []T{}
	}

	return page, nil
}

// Encode convierte los valores del cursor en un texto opaco.
func Encode(value any) (string, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(raw), nil
}

// Decode es la inversa de Encode. Un cursor vacío no es un error: significa
// "primera página" y deja `target` intacto (false indica que no había cursor).
func Decode(token string, target any) (bool, error) {
	if token == "" {
		return false, nil
	}

	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return false, ErrInvalidCursor
	}

	if err := json.Unmarshal(raw, target); err != nil {
		return false, ErrInvalidCursor
	}

	return true, nil
}
