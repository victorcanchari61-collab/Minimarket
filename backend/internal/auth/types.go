// Package auth es el módulo de acceso: inicio de sesión por token, usuario
// autenticado y cierre de sesión.
package auth

import "time"

type User struct {
	ID              int64
	Name            string
	Email           string
	EmailVerifiedAt *time.Time
	PasswordHash    string
	Active          bool
}

// UserResource es la forma del usuario en las respuestas JSON. Nunca incluye el
// hash de la contraseña.
type UserResource struct {
	ID              int64      `json:"id"`
	Name            string     `json:"name"`
	Email           string     `json:"email"`
	EmailVerifiedAt *time.Time `json:"email_verified_at"`
}

func (u User) Resource() UserResource {
	return UserResource{
		ID:              u.ID,
		Name:            u.Name,
		Email:           u.Email,
		EmailVerifiedAt: u.EmailVerifiedAt,
	}
}
