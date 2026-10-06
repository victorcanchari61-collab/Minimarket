// Package apperror define los errores de negocio de la API.
//
// Un servicio no devuelve "false" ni arma respuestas HTTP: devuelve un *Error
// con su Code. Un único middleware (httpx.Errors) lo convierte en JSON, así el
// frontend decide qué mostrar por el código y no por el texto del mensaje.
package apperror

import (
	"fmt"
	"net/http"
)

// Code es el código estable de un error. El frontend se guía por este valor.
type Code string

const (
	Validation         Code = "VALIDATION_ERROR"
	InvalidCredentials Code = "INVALID_CREDENTIALS"
	Unauthenticated    Code = "UNAUTHENTICATED"
	Forbidden          Code = "FORBIDDEN"
	NotFound           Code = "NOT_FOUND"
	Conflict           Code = "CONFLICT"
	TooManyRequests    Code = "TOO_MANY_REQUESTS"
	Internal           Code = "INTERNAL_ERROR"
)

// HTTPStatus es el estado HTTP que le corresponde a cada código.
func (c Code) HTTPStatus() int {
	switch c {
	case Validation, InvalidCredentials:
		return http.StatusUnprocessableEntity
	case Unauthenticated:
		return http.StatusUnauthorized
	case Forbidden:
		return http.StatusForbidden
	case NotFound:
		return http.StatusNotFound
	case Conflict:
		return http.StatusConflict
	case TooManyRequests:
		return http.StatusTooManyRequests
	default:
		return http.StatusInternalServerError
	}
}

// Error es un error de negocio listo para mostrarse al usuario.
type Error struct {
	Code    Code
	Message string
	// Fields son los errores por campo (formato de validación): campo -> mensajes.
	Fields map[string][]string
	// Context son datos extra para el frontend (por ejemplo, el stock disponible).
	Context map[string]any
}

func (e *Error) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func New(code Code, message string) *Error {
	return &Error{Code: code, Message: message}
}

// WithContext agrega datos de contexto y devuelve el mismo error.
func (e *Error) WithContext(context map[string]any) *Error {
	e.Context = context

	return e
}

// ValidationFields arma un error de validación con mensajes por campo.
func ValidationFields(fields map[string][]string) *Error {
	return &Error{
		Code:    Validation,
		Message: "Los datos enviados no son válidos.",
		Fields:  fields,
	}
}
