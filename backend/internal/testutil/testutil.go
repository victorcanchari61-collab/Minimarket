// Package testutil reúne lo común de las pruebas que usan PostgreSQL real: la
// base minimarket_test, el enrutador y utilidades para llamar a la API.
package testutil

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"minimarket/backend/internal/auth"
	"minimarket/backend/internal/permission"
	"minimarket/backend/internal/platform/config"
	"minimarket/backend/internal/platform/database"
	"minimarket/backend/internal/server"
)

const (
	adminURL = "postgres://postgres@localhost:5432/postgres?sslmode=disable"
	testURL  = "postgres://postgres@localhost:5432/minimarket_test?sslmode=disable"
)

func init() {
	// Sin el listado de rutas de Gin en cada prueba: ensucia la salida.
	gin.DebugPrintRouteFunc = func(string, string, string, int) {}
}

// Pool crea (si falta) la base minimarket_test, la migra y la deja vacía. Si
// PostgreSQL no está disponible la prueba se omite en lugar de fallar.
func Pool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	ctx := context.Background()

	admin, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		t.Skipf("PostgreSQL no disponible: %v", err)
	}

	var exists bool
	_ = admin.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'minimarket_test')`).Scan(&exists)

	if !exists {
		if _, err := admin.Exec(ctx, `CREATE DATABASE minimarket_test ENCODING 'UTF8'`); err != nil {
			t.Fatalf("no se pudo crear minimarket_test: %v", err)
		}
	}

	_ = admin.Close(ctx)

	// Los paquetes de prueba corren en paralelo y comparten esta base: un
	// candado de PostgreSQL (conexión propia, vive lo que dura la prueba) hace
	// que cada prueba tenga la base para ella sola.
	lock, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		t.Fatalf("candado de pruebas: %v", err)
	}

	if _, err := lock.Exec(ctx, `SELECT pg_advisory_lock(746100)`); err != nil {
		t.Fatalf("candado de pruebas: %v", err)
	}

	t.Cleanup(func() { _ = lock.Close(context.Background()) }) // al cerrar, PostgreSQL libera el candado

	pool, err := database.Connect(ctx, testURL)
	if err != nil {
		t.Fatalf("conexión de pruebas: %v", err)
	}

	t.Cleanup(pool.Close)

	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatalf("migraciones: %v", err)
	}

	// Las unidades son datos de referencia de la migración: se conservan.
	if _, err := pool.Exec(ctx, `
		TRUNCATE api_tokens, users, products, product_categories, warehouses, branches RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("limpieza: %v", err)
	}

	// La empresa es un dato de la migración: se conserva, pero vuelve a su estado inicial.
	if _, err := pool.Exec(ctx, `
		UPDATE companies SET ruc = NULL, legal_name = 'Mi empresa', trade_name = '',
		       fiscal_address = '', phone = '', email = ''`); err != nil {
		t.Fatalf("limpieza de empresa: %v", err)
	}

	// Los roles del sistema (Administrador) son datos de la migración: se
	// conservan; los demás (iniciales o de otra prueba) se borran.
	if _, err := pool.Exec(ctx, `DELETE FROM roles WHERE code IS DISTINCT FROM 'admin'`); err != nil {
		t.Fatalf("limpieza de roles: %v", err)
	}

	return pool
}

// Router arma la API completa sobre la base de pruebas.
func Router(t *testing.T, env string) (*gin.Engine, *pgxpool.Pool) {
	t.Helper()

	pool := Pool(t)

	return RouterOn(t, pool, env), pool
}

// RouterOn arma otra API (por ejemplo con otro entorno) sobre una base que la
// prueba ya tiene abierta: pedir otro Pool dentro de la misma prueba se
// bloquearía esperando su propio candado.
func RouterOn(t *testing.T, pool *pgxpool.Pool, env string) *gin.Engine {
	t.Helper()

	gin.SetMode(gin.TestMode)

	cfg := config.Config{Env: env, DatabaseURL: testURL, AllowedOrigins: []string{"http://minimarket.test"}}

	return server.New(cfg, pool)
}

// Call hace una petición JSON a la API; token vacío = sin sesión.
func Call(router *gin.Engine, method, path, token string, body any) *httptest.ResponseRecorder {
	var payload bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&payload).Encode(body)
	}

	req := httptest.NewRequest(method, path, &payload)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	return rec
}

// Decode lee la respuesta como un objeto JSON.
func Decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("respuesta no es JSON: %s", rec.Body.String())
	}

	return out
}

// SeedDemo crea el usuario de prueba como Administrador.
func SeedDemo(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	ctx := context.Background()

	demo, err := auth.NewService(auth.NewStore(pool), 0).EnsureDemoUser(ctx)
	if err != nil {
		t.Fatal(err)
	}

	if err := permission.New(pool).AssignAdmin(ctx, demo.ID); err != nil {
		t.Fatal(err)
	}
}

// Login crea el usuario de prueba (Administrador), inicia sesión y devuelve el token.
func Login(t *testing.T, router *gin.Engine, pool *pgxpool.Pool) string {
	t.Helper()

	SeedDemo(t, pool)

	rec := Call(router, "POST", "/api/login", "", map[string]string{
		"email": auth.DemoEmail, "password": auth.DemoPassword,
	})
	if rec.Code != 200 {
		t.Fatalf("login falló: %d %s", rec.Code, rec.Body.String())
	}

	return Decode(t, rec)["token"].(string)
}

// NewUser crea un usuario sin ningún permiso (contraseña DemoPassword) y
// devuelve su id.
func NewUser(t *testing.T, pool *pgxpool.Pool, email string) int64 {
	t.Helper()

	hash, err := bcrypt.GenerateFromPassword([]byte(auth.DemoPassword), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}

	user, err := auth.NewStore(pool).EnsureUser(context.Background(), "Usuario "+email, email, string(hash))
	if err != nil {
		t.Fatal(err)
	}

	return user.ID
}

// LoginAs inicia sesión con un usuario creado por NewUser y devuelve el token.
func LoginAs(t *testing.T, router *gin.Engine, email string) string {
	t.Helper()

	rec := Call(router, "POST", "/api/login", "", map[string]string{
		"email": email, "password": auth.DemoPassword,
	})
	if rec.Code != 200 {
		t.Fatalf("login de %s falló: %d %s", email, rec.Code, rec.Body.String())
	}

	return Decode(t, rec)["token"].(string)
}
