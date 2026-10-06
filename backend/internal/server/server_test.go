package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"minimarket/backend/internal/config"
	"minimarket/backend/internal/database"
	"minimarket/backend/internal/modules/auth"
	"minimarket/backend/internal/server"
)

const (
	adminURL = "postgres://postgres@localhost:5432/postgres?sslmode=disable"
	testURL  = "postgres://postgres@localhost:5432/minimarket_test?sslmode=disable"
)

// testPool crea (si falta) la base minimarket_test, la migra y la deja vacía.
// Si PostgreSQL no está disponible la prueba se omite en lugar de fallar.
func testPool(t *testing.T) *pgxpool.Pool {
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

	pool, err := database.Connect(ctx, testURL)
	if err != nil {
		t.Fatalf("conexión de pruebas: %v", err)
	}

	t.Cleanup(pool.Close)

	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatalf("migraciones: %v", err)
	}

	if _, err := pool.Exec(ctx, `TRUNCATE api_tokens, users RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("limpieza: %v", err)
	}

	return pool
}

func newRouter(t *testing.T, env string) (*gin.Engine, *pgxpool.Pool) {
	t.Helper()

	gin.SetMode(gin.TestMode)

	pool := testPool(t)
	cfg := config.Config{Env: env, DatabaseURL: testURL, AllowedOrigins: []string{"http://minimarket.test"}}

	return server.New(cfg, pool), pool
}

func call(router *gin.Engine, method, path, token string, body any) *httptest.ResponseRecorder {
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

func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("respuesta no es JSON: %s", rec.Body.String())
	}

	return out
}

func seedDemo(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	service := auth.NewService(auth.NewRepository(pool), 0)
	if err := service.EnsureDemoUser(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func login(t *testing.T, router *gin.Engine) string {
	t.Helper()

	rec := call(router, "POST", "/api/login", "", map[string]string{
		"email": auth.DemoEmail, "password": auth.DemoPassword,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("login falló: %d %s", rec.Code, rec.Body.String())
	}

	return decode(t, rec)["token"].(string)
}

func TestLoginReturnsTokenAndUser(t *testing.T) {
	router, pool := newRouter(t, "local")
	seedDemo(t, pool)

	rec := call(router, "POST", "/api/login", "", map[string]string{
		"email": auth.DemoEmail, "password": auth.DemoPassword,
	})

	if rec.Code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d: %s", rec.Code, rec.Body.String())
	}

	body := decode(t, rec)
	if body["token"] == "" || body["token_type"] != "Bearer" {
		t.Fatalf("falta token: %v", body)
	}

	user := body["user"].(map[string]any)
	if user["email"] != auth.DemoEmail {
		t.Fatalf("correo inesperado: %v", user)
	}

	if _, leaked := user["password_hash"]; leaked {
		t.Fatal("el hash de la contraseña no debe salir en la respuesta")
	}
}

func TestLoginRejectsWrongPasswordAndUnknownEmail(t *testing.T) {
	router, pool := newRouter(t, "local")
	seedDemo(t, pool)

	for _, creds := range []map[string]string{
		{"email": auth.DemoEmail, "password": "incorrecta"},
		{"email": "nadie@minimarket.test", "password": "password"},
	} {
		rec := call(router, "POST", "/api/login", "", creds)
		if rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("esperaba 422, llegó %d", rec.Code)
		}

		body := decode(t, rec)
		if body["code"] != "INVALID_CREDENTIALS" {
			t.Fatalf("código inesperado: %v", body["code"])
		}

		errs := body["errors"].(map[string]any)
		if _, ok := errs["email"]; !ok {
			t.Fatalf("falta el error del campo email: %v", errs)
		}
	}
}

func TestLoginValidatesInput(t *testing.T) {
	router, _ := newRouter(t, "local")

	rec := call(router, "POST", "/api/login", "", map[string]string{"email": "no-es-correo"})
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("esperaba 422, llegó %d", rec.Code)
	}

	errs := decode(t, rec)["errors"].(map[string]any)
	if _, ok := errs["email"]; !ok {
		t.Fatalf("falta error de email: %v", errs)
	}

	if _, ok := errs["password"]; !ok {
		t.Fatalf("falta error de password: %v", errs)
	}
}

func TestUserRequiresValidToken(t *testing.T) {
	router, pool := newRouter(t, "local")
	seedDemo(t, pool)

	if rec := call(router, "GET", "/api/user", "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("sin token esperaba 401, llegó %d", rec.Code)
	}

	if rec := call(router, "GET", "/api/user", "token-falso", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("con token falso esperaba 401, llegó %d", rec.Code)
	}

	token := login(t, router)

	rec := call(router, "GET", "/api/user", token, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("con token esperaba 200, llegó %d", rec.Code)
	}

	data := decode(t, rec)["data"].(map[string]any)
	if data["email"] != auth.DemoEmail {
		t.Fatalf("usuario inesperado: %v", data)
	}
}

func TestLogoutRevokesToken(t *testing.T) {
	router, pool := newRouter(t, "local")
	seedDemo(t, pool)

	token := login(t, router)

	if rec := call(router, "POST", "/api/logout", token, nil); rec.Code != http.StatusOK {
		t.Fatalf("logout esperaba 200, llegó %d", rec.Code)
	}

	if rec := call(router, "GET", "/api/user", token, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("tras cerrar sesión esperaba 401, llegó %d", rec.Code)
	}
}

func TestLoginIsRateLimited(t *testing.T) {
	router, pool := newRouter(t, "local")
	seedDemo(t, pool)

	var last int

	for range 7 {
		last = call(router, "POST", "/api/login", "", map[string]string{
			"email": auth.DemoEmail, "password": "incorrecta",
		}).Code
	}

	if last != http.StatusTooManyRequests {
		t.Fatalf("tras 7 intentos esperaba 429, llegó %d", last)
	}
}

func TestDemoCredentialsOnlyInLocal(t *testing.T) {
	local, _ := newRouter(t, "local")

	rec := call(local, "GET", "/api/demo-credentials", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("en local esperaba 200, llegó %d", rec.Code)
	}

	if decode(t, rec)["data"].(map[string]any)["email"] != auth.DemoEmail {
		t.Fatal("credenciales de prueba inesperadas")
	}

	// El usuario de prueba quedó creado: el login con esas credenciales funciona.
	login(t, local)

	production, _ := newRouter(t, "production")
	if rec := call(production, "GET", "/api/demo-credentials", "", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("en producción esperaba 404, llegó %d", rec.Code)
	}
}

func TestUnknownRouteIsJSON404(t *testing.T) {
	router, _ := newRouter(t, "local")

	rec := call(router, "GET", "/api/no-existe", "", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("esperaba 404, llegó %d", rec.Code)
	}

	if decode(t, rec)["code"] != "NOT_FOUND" {
		t.Fatal("el 404 debe ser JSON con código NOT_FOUND")
	}
}

func TestHealthEndpoints(t *testing.T) {
	router, _ := newRouter(t, "local")

	for _, path := range []string{"/up", "/api/health"} {
		if rec := call(router, "GET", path, "", nil); rec.Code != http.StatusOK {
			t.Fatalf("%s esperaba 200, llegó %d", path, rec.Code)
		}
	}
}

func TestMain(m *testing.M) {
	os.Exit(m.Run())
}
