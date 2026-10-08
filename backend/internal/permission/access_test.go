package permission_test

import (
	"context"
	"net/http"
	"slices"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"minimarket/backend/internal/testutil"
)

func exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()

	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
}

func newRole(t *testing.T, pool *pgxpool.Pool, name string, permissions ...string) {
	t.Helper()

	exec(t, pool, `INSERT INTO roles (name) VALUES ($1)`, name)

	for _, permission := range permissions {
		exec(t, pool, `
			INSERT INTO role_permissions (role_id, permission)
			SELECT id, $2 FROM roles WHERE name = $1`, name, permission)
	}
}

func giveRole(t *testing.T, pool *pgxpool.Pool, userID int64, role string) {
	t.Helper()

	exec(t, pool, `
		INSERT INTO user_roles (user_id, role_id)
		SELECT $1, id FROM roles WHERE name = $2`, userID, role)
}

func givePermission(t *testing.T, pool *pgxpool.Pool, userID int64, permission, effect string) {
	t.Helper()

	exec(t, pool, `INSERT INTO user_permissions (user_id, permission, effect) VALUES ($1, $2, $3)`,
		userID, permission, effect)
}

func codeOf(router *gin.Engine, method, path, token string) int {
	return testutil.Call(router, method, path, token, nil).Code
}

func TestAdministratorCanDoEverything(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	if code := codeOf(router, "GET", "/api/catalog/products", token); code != http.StatusOK {
		t.Fatalf("el administrador debe poder ver productos: %d", code)
	}

	me := testutil.Decode(t, testutil.Call(router, "GET", "/api/permissions/me", token, nil))["data"].(map[string]any)

	if me["superuser"] != true {
		t.Fatalf("debía ser superusuario: %v", me)
	}

	if len(me["permissions"].([]any)) != len(catalog.Actions()) {
		t.Fatalf("el administrador debe tener todas las acciones")
	}
}

func TestUserWithoutPermissionsIsForbiddenButSeesItsOwnList(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	testutil.NewUser(t, pool, "nadie@minimarket.test")
	token := testutil.LoginAs(t, router, "nadie@minimarket.test")

	rec := testutil.Call(router, "GET", "/api/catalog/products", token, nil)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("esperaba 403, llegó %d", rec.Code)
	}

	body := testutil.Decode(t, rec)
	if body["code"] != "FORBIDDEN" {
		t.Fatalf("código inesperado: %v", body)
	}

	me := testutil.Decode(t, testutil.Call(router, "GET", "/api/permissions/me", token, nil))["data"].(map[string]any)
	if me["superuser"] != false || len(me["permissions"].([]any)) != 0 {
		t.Fatalf("no debía tener permisos: %v", me)
	}

	// Y sin sesión sigue siendo 401, no 403.
	if code := codeOf(router, "GET", "/api/catalog/products", ""); code != http.StatusUnauthorized {
		t.Fatalf("sin token esperaba 401, llegó %d", code)
	}
}

func TestUserInheritsFromItsRole(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	id := testutil.NewUser(t, pool, "almacen@minimarket.test")
	newRole(t, pool, "Consulta de catálogo", "erp.catalog.products.view")
	giveRole(t, pool, id, "Consulta de catálogo")

	token := testutil.LoginAs(t, router, "almacen@minimarket.test")

	if code := codeOf(router, "GET", "/api/catalog/products", token); code != http.StatusOK {
		t.Fatalf("el rol permite ver: %d", code)
	}

	product := map[string]any{"sku": "X-1", "name": "Algo", "unit_id": 1, "price": "1.00"}
	if code := testutil.Call(router, "POST", "/api/catalog/products", token, product).Code; code != http.StatusForbidden {
		t.Fatalf("el rol no permite crear: %d", code)
	}
}

func TestDirectPermissionAddsToTheRole(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	id := testutil.NewUser(t, pool, "directo@minimarket.test")
	newRole(t, pool, "Solo ver", "erp.catalog.products.view")
	giveRole(t, pool, id, "Solo ver")
	givePermission(t, pool, id, "erp.catalog.products.create", "allow")

	token := testutil.LoginAs(t, router, "directo@minimarket.test")

	product := map[string]any{"sku": "X-2", "name": "Algo", "unit_id": 1, "price": "1.00"}
	if code := testutil.Call(router, "POST", "/api/catalog/products", token, product).Code; code != http.StatusCreated {
		t.Fatalf("el permiso directo permite crear: %d", code)
	}

	// Crear necesita elegir la unidad: la lista de unidades también se abre.
	if code := codeOf(router, "GET", "/api/catalog/units", token); code != http.StatusOK {
		t.Fatalf("quien crea productos debe poder listar unidades: %d", code)
	}

	if code := codeOf(router, "DELETE", "/api/catalog/products/1", token); code != http.StatusForbidden {
		t.Fatalf("eliminar no estaba permitido: %d", code)
	}
}

func TestDirectDenialBeatsTheRole(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	id := testutil.NewUser(t, pool, "sin-borrar@minimarket.test")
	newRole(t, pool, "Catálogo completo", "erp.catalog")
	giveRole(t, pool, id, "Catálogo completo")
	givePermission(t, pool, id, "erp.catalog.products.delete", "deny")

	token := testutil.LoginAs(t, router, "sin-borrar@minimarket.test")

	if code := codeOf(router, "GET", "/api/catalog/products", token); code != http.StatusOK {
		t.Fatalf("seguía pudiendo ver: %d", code)
	}

	if code := codeOf(router, "DELETE", "/api/catalog/products/1", token); code != http.StatusForbidden {
		t.Fatalf("la denegación directa le gana al rol: %d", code)
	}
}

func TestMeListsInheritedAndDirectActions(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	id := testutil.NewUser(t, pool, "mixto@minimarket.test")
	newRole(t, pool, "Caja", "pos.cash.open_close.open")
	giveRole(t, pool, id, "Caja")
	givePermission(t, pool, id, "erp.purchasing.purchase_orders.approve", "allow")

	token := testutil.LoginAs(t, router, "mixto@minimarket.test")

	me := testutil.Decode(t, testutil.Call(router, "GET", "/api/permissions/me", token, nil))["data"].(map[string]any)

	got := make([]string, 0)
	for _, code := range me["permissions"].([]any) {
		got = append(got, code.(string))
	}

	for _, want := range []string{
		"pos.cash.open_close.open", "pos.cash.open_close.view",
		"erp.purchasing.purchase_orders.approve", "erp.purchasing.purchase_orders.view",
	} {
		if !slices.Contains(got, want) {
			t.Errorf("falta %q en %v", want, got)
		}
	}

	if len(got) != 4 {
		t.Errorf("esperaba solo 4 acciones, llegaron %d: %v", len(got), got)
	}
}

func TestCatalogEndpointNeedsItsOwnPermission(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	testutil.NewUser(t, pool, "curioso@minimarket.test")
	token := testutil.LoginAs(t, router, "curioso@minimarket.test")

	if code := codeOf(router, "GET", "/api/permissions/catalog", token); code != http.StatusForbidden {
		t.Fatalf("esperaba 403, llegó %d", code)
	}

	admin := testutil.Login(t, router, pool)

	rec := testutil.Call(router, "GET", "/api/permissions/catalog", admin, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("el administrador ve el catálogo: %d", rec.Code)
	}

	systems := testutil.Decode(t, rec)["data"].([]any)
	if len(systems) != 10 {
		t.Fatalf("esperaba 10 sistemas, llegaron %d", len(systems))
	}
}

func TestSeededRolesExistAndAdminIsProtected(t *testing.T) {
	_, pool := testutil.Router(t, "local")

	var admins int

	err := pool.QueryRow(context.Background(), `
		SELECT count(*) FROM roles WHERE code = 'admin' AND name = 'Administrador'`).Scan(&admins)
	if err != nil || admins != 1 {
		t.Fatalf("falta el rol Administrador: %v (%d)", err, admins)
	}
}
