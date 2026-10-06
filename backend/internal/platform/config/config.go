// Package config lee la configuración del servicio desde variables de entorno
// (y, si existe, desde un archivo .env en la carpeta de trabajo).
package config

import (
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	// Env es "local" o "production". Solo en local se ofrecen las credenciales de prueba.
	Env string
	// Port en el que escucha la API.
	Port string
	// DatabaseURL es la cadena de conexión a PostgreSQL.
	DatabaseURL string
	// AllowedOrigins son los orígenes del frontend que pueden llamar a la API desde el navegador.
	AllowedOrigins []string
	// TokenTTL es lo que dura un token sin "recordarme". Cero = no vence.
	TokenTTL time.Duration
}

func Load() Config {
	_ = godotenv.Load() // el .env es opcional: en producción manda el entorno.

	return Config{
		Env:         get("APP_ENV", "local"),
		Port:        get("PORT", "8080"),
		DatabaseURL: get("DATABASE_URL", "postgres://postgres@localhost:5432/minimarket?sslmode=disable"),
		AllowedOrigins: split(get("ALLOWED_ORIGINS",
			"http://minimarket.test,http://localhost:5173")),
		TokenTTL: duration(get("TOKEN_TTL", "0")),
	}
}

func (c Config) IsLocal() bool {
	return c.Env == "local"
}

func get(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}

	return fallback
}

func split(value string) []string {
	var parts []string

	for _, part := range strings.Split(value, ",") {
		if part = strings.TrimSpace(part); part != "" {
			parts = append(parts, part)
		}
	}

	return parts
}

func duration(value string) time.Duration {
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0
	}

	return parsed
}
