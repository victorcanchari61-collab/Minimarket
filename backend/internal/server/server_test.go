package server_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"minimarket/backend/internal/auth"
	"minimarket/backend/internal/testutil"
)

func seedDemo(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	if err := auth.NewService(auth.NewStore(pool), 0).EnsureDemoUser(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestLoginReturnsTokenAndUser(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	seedDemo(t, pool)

	rec := testutil.Call(router, "POST", "/api/login", "", map[string]string{
		"email": auth.DemoEmail, "password": auth.DemoPassword,
	})

	if rec.Code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d: %s", rec.Code, rec.Body.String())
	}

	body := testutil.Decode(t, rec)
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
	router, pool := testutil.Router(t, "local")
	seedDemo(t, pool)

	for _, creds := range []map[string]string{
		{"email": auth.DemoEmail, "password": "incorrecta"},
		{"email": "nadie@minimarket.test", "password": "password"},
	} {
		rec := testutil.Call(router, "POST", "/api/login", "", creds)
		if rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("esperaba 422, llegó %d", rec.Code)
		}

		body := testutil.Decode(t, rec)
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
	router, _ := testutil.Router(t, "local")

	rec := testutil.Call(router, "POST", "/api/login", "", map[string]string{"email": "no-es-correo"})
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("esperaba 422, llegó %d", rec.Code)
	}

	errs := testutil.Decode(t, rec)["errors"].(map[string]any)
	if _, ok := errs["email"]; !ok {
		t.Fatalf("falta error de email: %v", errs)
	}

	if _, ok := errs["password"]; !ok {
		t.Fatalf("falta error de password: %v", errs)
	}
}

func TestUserRequiresValidToken(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	seedDemo(t, pool)

	if rec := testutil.Call(router, "GET", "/api/user", "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("sin token esperaba 401, llegó %d", rec.Code)
	}

	if rec := testutil.Call(router, "GET", "/api/user", "token-falso", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("con token falso esperaba 401, llegó %d", rec.Code)
	}

	token := testutil.Login(t, router, pool)

	rec := testutil.Call(router, "GET", "/api/user", token, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("con token esperaba 200, llegó %d", rec.Code)
	}

	data := testutil.Decode(t, rec)["data"].(map[string]any)
	if data["email"] != auth.DemoEmail {
		t.Fatalf("usuario inesperado: %v", data)
	}
}

func TestLogoutRevokesToken(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	if rec := testutil.Call(router, "POST", "/api/logout", token, nil); rec.Code != http.StatusOK {
		t.Fatalf("logout esperaba 200, llegó %d", rec.Code)
	}

	if rec := testutil.Call(router, "GET", "/api/user", token, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("tras cerrar sesión esperaba 401, llegó %d", rec.Code)
	}
}

func TestLoginIsRateLimited(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	seedDemo(t, pool)

	var last int

	for range 7 {
		last = testutil.Call(router, "POST", "/api/login", "", map[string]string{
			"email": auth.DemoEmail, "password": "incorrecta",
		}).Code
	}

	if last != http.StatusTooManyRequests {
		t.Fatalf("tras 7 intentos esperaba 429, llegó %d", last)
	}
}

func TestDemoCredentialsOnlyInLocal(t *testing.T) {
	local, pool := testutil.Router(t, "local")

	rec := testutil.Call(local, "GET", "/api/demo-credentials", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("en local esperaba 200, llegó %d", rec.Code)
	}

	if testutil.Decode(t, rec)["data"].(map[string]any)["email"] != auth.DemoEmail {
		t.Fatal("credenciales de prueba inesperadas")
	}

	// El usuario de prueba quedó creado: el login con esas credenciales funciona.
	testutil.Login(t, local, pool)

	production := testutil.RouterOn(t, pool, "production")
	if rec := testutil.Call(production, "GET", "/api/demo-credentials", "", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("en producción esperaba 404, llegó %d", rec.Code)
	}
}

func TestUnknownRouteIsJSON404(t *testing.T) {
	router, _ := testutil.Router(t, "local")

	rec := testutil.Call(router, "GET", "/api/no-existe", "", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("esperaba 404, llegó %d", rec.Code)
	}

	if testutil.Decode(t, rec)["code"] != "NOT_FOUND" {
		t.Fatal("el 404 debe ser JSON con código NOT_FOUND")
	}
}

func TestHealthEndpoints(t *testing.T) {
	router, _ := testutil.Router(t, "local")

	for _, path := range []string{"/up", "/api/health"} {
		if rec := testutil.Call(router, "GET", path, "", nil); rec.Code != http.StatusOK {
			t.Fatalf("%s esperaba 200, llegó %d", path, rec.Code)
		}
	}
}
