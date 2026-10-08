package permissions_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"minimarket/backend/internal/testutil"
)

func send(router *gin.Engine, method, path, token string, body any) (int, map[string]any) {
	rec := testutil.Call(router, method, path, token, body)

	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)

	return rec.Code, out
}

func exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()

	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
}

func newRole(t *testing.T, pool *pgxpool.Pool, name string, permissions ...string) int64 {
	t.Helper()

	var id int64
	if err := pool.QueryRow(context.Background(), `INSERT INTO roles (name) VALUES ($1) RETURNING id`, name).Scan(&id); err != nil {
		t.Fatal(err)
	}

	for _, permission := range permissions {
		exec(t, pool, `INSERT INTO role_permissions (role_id, permission) VALUES ($1, $2)`, id, permission)
	}

	return id
}

func giveRole(t *testing.T, pool *pgxpool.Pool, userID, roleID int64) {
	t.Helper()

	exec(t, pool, `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, userID, roleID)
}

func giveDirect(t *testing.T, pool *pgxpool.Pool, userID int64, permission string) {
	t.Helper()

	exec(t, pool, `INSERT INTO user_permissions (user_id, permission, effect) VALUES ($1, $2, 'allow')`, userID, permission)
}

func strings(value any) []string {
	var out []string

	for _, item := range value.([]any) {
		out = append(out, item.(string))
	}

	return out
}

func TestRolePermissionsAreReplacedAndTakeEffectAtOnce(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	roleID := newRole(t, pool, "Consulta")
	userID := testutil.NewUser(t, pool, "consulta@minimarket.test")
	giveRole(t, pool, userID, roleID)

	user := testutil.LoginAs(t, router, "consulta@minimarket.test")

	if code := testutil.Call(router, "GET", "/api/catalog/products", user, nil).Code; code != http.StatusForbidden {
		t.Fatalf("sin permisos esperaba 403, llegó %d", code)
	}

	url := fmt.Sprintf("/api/access/roles/%d", roleID)

	if code, body := send(router, "PUT", url, admin, map[string]any{"permissions": []string{"erp.catalog.products", "erp.catalog.products.view"}}); code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d: %v", code, body)
	}

	if code := testutil.Call(router, "GET", "/api/catalog/products", user, nil).Code; code != http.StatusOK {
		t.Fatalf("con el permiso puede ver productos: %d", code)
	}

	_, roles := send(router, "GET", "/api/access/roles", admin, nil)

	var found bool

	for _, item := range roles["data"].([]any) {
		role := item.(map[string]any)
		if role["name"] == "Consulta" {
			found = true

			if got := strings(role["permissions"]); len(got) != 2 || got[0] != "erp.catalog.products" {
				t.Fatalf("permisos sin repetir y en orden: %v", got)
			}

			if role["user_count"] != float64(1) {
				t.Fatalf("lo tiene un usuario: %v", role)
			}
		}
	}

	if !found {
		t.Fatal("el rol debía aparecer en la lista")
	}
}

func TestRolePermissionsAreValidated(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	roleID := newRole(t, pool, "Prueba")
	url := fmt.Sprintf("/api/access/roles/%d", roleID)

	for name, permissions := range map[string][]string{
		"permiso inexistente": {"erp.catalog.products.fly"},
		"acceso total":        {"*"},
	} {
		if code, _ := send(router, "PUT", url, admin, map[string]any{"permissions": permissions}); code != http.StatusUnprocessableEntity {
			t.Errorf("%s: esperaba 422, llegó %d", name, code)
		}
	}

	var adminRole int64
	if err := pool.QueryRow(context.Background(), `SELECT id FROM roles WHERE code = 'admin'`).Scan(&adminRole); err != nil {
		t.Fatal(err)
	}

	if code, _ := send(router, "PUT", fmt.Sprintf("/api/access/roles/%d", adminRole), admin, map[string]any{"permissions": []string{}}); code != http.StatusConflict {
		t.Fatalf("el administrador no se toca: %d", code)
	}

	if code, _ := send(router, "PUT", "/api/access/roles/99999", admin, map[string]any{"permissions": []string{}}); code != http.StatusNotFound {
		t.Fatalf("rol inexistente esperaba 404, llegó %d", code)
	}
}

func TestPersonAccessShowsWhereEachThingComesFrom(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	userID := testutil.NewUser(t, pool, "mixta@minimarket.test")
	giveRole(t, pool, userID, newRole(t, pool, "Caja", "pos.cash"))
	giveDirect(t, pool, userID, "erp.purchasing.purchase_orders.approve")

	code, found := send(router, "GET", "/api/access/users?search=mixta", admin, nil)
	if code != http.StatusOK || len(found["data"].([]any)) != 1 {
		t.Fatalf("la búsqueda debía dar 1 persona: %d %v", code, found)
	}

	_, shown := send(router, "GET", fmt.Sprintf("/api/access/users/%d", userID), admin, nil)
	data := shown["data"].(map[string]any)

	if got := strings(data["role_permissions"]); len(got) != 1 || got[0] != "pos.cash" {
		t.Fatalf("lo del rol: %v", got)
	}

	if got := strings(data["allow"]); len(got) != 1 || got[0] != "erp.purchasing.purchase_orders.approve" {
		t.Fatalf("lo directo: %v", got)
	}

	if data["person"].(map[string]any)["is_admin"] != false {
		t.Fatalf("no es administrador: %v", data["person"])
	}
}

func TestPersonAccessIsReplacedAndDenialsWork(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	userID := testutil.NewUser(t, pool, "gestor@minimarket.test")
	giveRole(t, pool, userID, newRole(t, pool, "Catálogo", "erp.catalog"))

	user := testutil.LoginAs(t, router, "gestor@minimarket.test")
	url := fmt.Sprintf("/api/access/users/%d", userID)

	if code, _ := send(router, "PUT", url, admin, map[string]any{
		"allow": []string{"pos.cash"},
		"deny":  []string{"erp.catalog.products.delete"},
	}); code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d", code)
	}

	if code := testutil.Call(router, "GET", "/api/catalog/products", user, nil).Code; code != http.StatusOK {
		t.Fatalf("el rol sigue dando ver: %d", code)
	}

	if code := testutil.Call(router, "DELETE", "/api/catalog/products/1", user, nil).Code; code != http.StatusForbidden {
		t.Fatalf("la denegación gana al rol: %d", code)
	}

	_, me := send(router, "GET", "/api/permissions/me", user, nil)
	if !contains(strings(me["data"].(map[string]any)["permissions"]), "pos.cash.open_close.open") {
		t.Fatal("el permiso directo debía estar entre sus acciones")
	}

	// Reemplazar deja solo lo nuevo.
	send(router, "PUT", url, admin, map[string]any{"allow": []string{}, "deny": []string{}})

	if code := testutil.Call(router, "DELETE", "/api/catalog/products/1", user, nil).Code; code == http.StatusForbidden {
		t.Fatalf("sin denegación vuelve a poder (llegó %d)", code)
	}
}

func contains(list []string, value string) bool {
	for _, item := range list {
		if item == value {
			return true
		}
	}

	return false
}

func TestPersonAccessRules(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	var adminID int64
	if err := pool.QueryRow(context.Background(), `SELECT id FROM users WHERE email = 'admin@minimarket.test'`).Scan(&adminID); err != nil {
		t.Fatal(err)
	}

	userID := testutil.NewUser(t, pool, "persona@minimarket.test")

	if code, _ := send(router, "PUT", fmt.Sprintf("/api/access/users/%d", adminID), admin, map[string]any{"allow": []string{}, "deny": []string{"pos"}}); code != http.StatusConflict {
		t.Fatalf("a un administrador no se le toca: %d", code)
	}

	url := fmt.Sprintf("/api/access/users/%d", userID)

	if code, _ := send(router, "PUT", url, admin, map[string]any{"allow": []string{"pos"}, "deny": []string{"pos"}}); code != http.StatusUnprocessableEntity {
		t.Fatalf("permitido y denegado a la vez esperaba 422, llegó %d", code)
	}

	if code, _ := send(router, "PUT", url, admin, map[string]any{"allow": []string{"*"}}); code != http.StatusUnprocessableEntity {
		t.Fatalf("no se da el acceso total: %d", code)
	}

	// Nadie cambia sus propios permisos: quien tiene "asignar" no se asciende solo.
	giveDirect(t, pool, userID, "config.roles.permissions")

	self := testutil.LoginAs(t, router, "persona@minimarket.test")
	if code, _ := send(router, "PUT", url, self, map[string]any{"allow": []string{"pos"}}); code != http.StatusConflict {
		t.Fatalf("cambiar los propios permisos esperaba 409, llegó %d", code)
	}
}

func TestAccessRequestsFlow(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	testutil.NewUser(t, pool, "pide@minimarket.test")
	asker := testutil.LoginAs(t, router, "pide@minimarket.test")

	ask := map[string]any{"permission": "erp.catalog.products.view", "reason": "Necesito consultar precios"}

	code, created := send(router, "POST", "/api/access/requests", asker, ask)
	if code != http.StatusCreated {
		t.Fatalf("esperaba 201, llegó %d: %v", code, created)
	}

	request := created["data"].(map[string]any)
	requestID := int64(request["id"].(float64))

	if request["status"] != "pending" || request["user_name"] == "" {
		t.Fatalf("solicitud inesperada: %v", request)
	}

	if code, _ := send(router, "POST", "/api/access/requests", asker, ask); code != http.StatusConflict {
		t.Fatalf("repetida esperaba 409, llegó %d", code)
	}

	for name, body := range map[string]map[string]any{
		"pantalla inexistente":     {"permission": "erp.nada.nada.view"},
		"un módulo, no una acción": {"permission": "erp.catalog"},
	} {
		if code, _ := send(router, "POST", "/api/access/requests", asker, body); code != http.StatusUnprocessableEntity {
			t.Errorf("%s: esperaba 422, llegó %d", name, code)
		}
	}

	// Quien no administra accesos no ve ni resuelve solicitudes.
	if code := testutil.Call(router, "GET", "/api/access/requests", asker, nil).Code; code != http.StatusForbidden {
		t.Fatalf("ver solicitudes sin permiso esperaba 403, llegó %d", code)
	}

	_, summary := send(router, "GET", "/api/access/requests/summary", admin, nil)
	if summary["data"].(map[string]any)["pending"] != float64(1) {
		t.Fatalf("debía haber 1 pendiente: %v", summary)
	}

	_, list := send(router, "GET", "/api/access/requests?status=pending", admin, nil)
	if len(list["data"].([]any)) != 1 {
		t.Fatalf("la lista de pendientes debía tener 1: %v", list)
	}

	if code := testutil.Call(router, "GET", "/api/catalog/products", asker, nil).Code; code != http.StatusForbidden {
		t.Fatalf("antes de aprobar no tiene acceso: %d", code)
	}

	approve := fmt.Sprintf("/api/access/requests/%d/approve", requestID)

	if code, _ := send(router, "POST", approve, asker, nil); code != http.StatusForbidden {
		t.Fatalf("aprobar sin permiso esperaba 403, llegó %d", code)
	}

	code, approved := send(router, "POST", approve, admin, nil)
	if code != http.StatusOK || approved["data"].(map[string]any)["status"] != "approved" {
		t.Fatalf("aprobar: %d %v", code, approved)
	}

	if code := testutil.Call(router, "GET", "/api/catalog/products", asker, nil).Code; code != http.StatusOK {
		t.Fatalf("aprobada: ya tiene acceso al instante: %d", code)
	}

	if code, _ := send(router, "POST", approve, admin, nil); code != http.StatusConflict {
		t.Fatalf("aprobar dos veces esperaba 409, llegó %d", code)
	}

	// Ya tiene el acceso: pedirlo otra vez no tiene sentido.
	if code, _ := send(router, "POST", "/api/access/requests", asker, ask); code != http.StatusConflict {
		t.Fatalf("pedir lo que ya tiene esperaba 409, llegó %d", code)
	}
}

func TestRejectingARequestLetsThemAskAgain(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	testutil.NewUser(t, pool, "insiste@minimarket.test")
	asker := testutil.LoginAs(t, router, "insiste@minimarket.test")

	ask := map[string]any{"permission": "pos.cash.open_close.open"}

	_, created := send(router, "POST", "/api/access/requests", asker, ask)
	id := int64(created["data"].(map[string]any)["id"].(float64))

	code, rejected := send(router, "POST", fmt.Sprintf("/api/access/requests/%d/reject", id), admin, map[string]any{"note": "Aún no"})
	if code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d: %v", code, rejected)
	}

	data := rejected["data"].(map[string]any)
	if data["status"] != "rejected" || data["decision_note"] != "Aún no" || data["decided_by_name"] == "" {
		t.Fatalf("rechazo inesperado: %v", data)
	}

	if code := testutil.Call(router, "GET", "/api/catalog/units", asker, nil).Code; code != http.StatusForbidden {
		t.Fatalf("rechazada no concede nada: %d", code)
	}

	if code, _ := send(router, "POST", "/api/access/requests", asker, ask); code != http.StatusCreated {
		t.Fatalf("tras un rechazo puede volver a pedir: %d", code)
	}

	_, summary := send(router, "GET", "/api/access/requests/summary", admin, nil)
	if summary["data"].(map[string]any)["pending"] != float64(1) {
		t.Fatalf("queda 1 pendiente: %v", summary)
	}
}

func TestRequestsListPaginatesBy20(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	userID := testutil.NewUser(t, pool, "muchas@minimarket.test")
	for i := 0; i < 24; i++ {
		exec(t, pool, `INSERT INTO access_requests (user_id, permission, created_at) VALUES ($1, $2, now() + $3 * interval '1 second')`,
			userID, fmt.Sprintf("erp.catalog.products.view#%d", i), i)
	}

	_, first := send(router, "GET", "/api/access/requests", admin, nil)
	if len(first["data"].([]any)) != 20 {
		t.Fatalf("la primera página debe tener 20, tiene %d", len(first["data"].([]any)))
	}

	cursor := first["meta"].(map[string]any)["next_cursor"].(string)

	_, second := send(router, "GET", "/api/access/requests?cursor="+cursor, admin, nil)
	if len(second["data"].([]any)) != 4 || second["meta"].(map[string]any)["next_cursor"] != nil {
		t.Fatalf("la segunda página debe tener 4 y ser la última: %v", second["meta"])
	}

	if code, _ := send(router, "GET", "/api/access/requests?status=otro", admin, nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("estado inválido esperaba 422, llegó %d", code)
	}
}

func TestEverythingNeedsItsPermission(t *testing.T) {
	router, pool := testutil.Router(t, "local")

	userID := testutil.NewUser(t, pool, "mira@minimarket.test")
	giveDirect(t, pool, userID, "config.roles.permissions.view")

	viewer := testutil.LoginAs(t, router, "mira@minimarket.test")

	for _, path := range []string{"/api/access/roles", "/api/access/users", "/api/access/requests", "/api/access/requests/summary"} {
		if code := testutil.Call(router, "GET", path, viewer, nil).Code; code != http.StatusOK {
			t.Errorf("GET %s con 'ver' esperaba 200, llegó %d", path, code)
		}
	}

	for _, request := range []struct{ method, path string }{
		{"PUT", "/api/access/roles/1"}, {"PUT", "/api/access/users/1"},
		{"POST", "/api/access/requests/1/approve"}, {"POST", "/api/access/requests/1/reject"},
	} {
		if code := testutil.Call(router, request.method, request.path, viewer, map[string]any{}).Code; code != http.StatusForbidden {
			t.Errorf("%s %s sin 'asignar' esperaba 403, llegó %d", request.method, request.path, code)
		}
	}
}

func TestRequestsListOnlyReturnsTheRequestedFields(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	testutil.NewUser(t, pool, "campos@minimarket.test")
	asker := testutil.LoginAs(t, router, "campos@minimarket.test")
	send(router, "POST", "/api/access/requests", asker, map[string]any{"permission": "pos.cash.open_close.open", "reason": "Necesito abrir caja"})

	_, list := send(router, "GET", "/api/access/requests?fields=permission,status", admin, nil)
	for _, item := range list["data"].([]any) {
		if got := fieldKeys(item); got != "id,permission,status" {
			t.Fatalf("permiso, estado e id: %s", got)
		}
	}

	if code, _ := send(router, "GET", "/api/access/requests?fields=nope", admin, nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("un campo que no existe esperaba 422, llegó %d", code)
	}
}

// fieldKeys devuelve los campos de una fila como "a,b,c" (ordenados). Este
// archivo ya tiene una función llamada strings, así que no usa el paquete.
func fieldKeys(item any) string {
	keys := make([]string, 0)
	for key := range item.(map[string]any) {
		keys = append(keys, key)
	}

	sort.Strings(keys)

	out := ""
	for i, key := range keys {
		if i > 0 {
			out += ","
		}

		out += key
	}

	return out
}
