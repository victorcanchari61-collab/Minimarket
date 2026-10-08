package roles_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
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

func roleBody(name string, permissions ...string) map[string]any {
	return map[string]any{"name": name, "description": "Rol de prueba", "permissions": permissions}
}

func idOf(body map[string]any) int64 {
	return int64(body["data"].(map[string]any)["id"].(float64))
}

func adminRoleID(t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()

	var id int64
	if err := pool.QueryRow(context.Background(), `SELECT id FROM roles WHERE code = 'admin'`).Scan(&id); err != nil {
		t.Fatal(err)
	}

	return id
}

func permissionsOf(body map[string]any) []string {
	var out []string

	for _, value := range body["data"].(map[string]any)["permissions"].([]any) {
		out = append(out, value.(string))
	}

	return out
}

func TestCreateRoleKeepsPermissionsAtAnyLevel(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	code, body := send(router, "POST", "/api/roles", token,
		roleBody("Vendedor", "pos.sales", "erp.catalog.products.view", "pos.sales"))
	if code != http.StatusCreated {
		t.Fatalf("esperaba 201, llegó %d: %v", code, body)
	}

	got := permissionsOf(body)
	if len(got) != 2 || got[0] != "erp.catalog.products.view" || got[1] != "pos.sales" {
		t.Fatalf("debían quedar 2 permisos sin repetir y en orden: %v", got)
	}

	role := body["data"].(map[string]any)
	if role["is_system"] != false || role["user_count"] != float64(0) {
		t.Fatalf("rol inesperado: %v", role)
	}
}

func TestRoleIsRejectedWithBadNameDuplicateOrWrongPermissions(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	send(router, "POST", "/api/roles", token, roleBody("Vendedor"))

	cases := map[string]struct {
		body map[string]any
		want int
	}{
		"nombre repetido (sin importar mayúsculas)": {roleBody("VENDEDOR"), http.StatusConflict},
		"sin nombre":          {roleBody("  "), http.StatusUnprocessableEntity},
		"permiso inexistente": {roleBody("A", "erp.catalog.products.fly"), http.StatusUnprocessableEntity},
		"módulo inexistente":  {roleBody("B", "erp.nada"), http.StatusUnprocessableEntity},
		"acceso total":        {roleBody("C", "*"), http.StatusUnprocessableEntity},
	}

	for name, tc := range cases {
		if code, body := send(router, "POST", "/api/roles", token, tc.body); code != tc.want {
			t.Errorf("%s: esperaba %d, llegó %d: %v", name, tc.want, code, body)
		}
	}
}

func TestUpdateReplacesPermissionsAndTakesEffectImmediately(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	_, created := send(router, "POST", "/api/roles", admin, roleBody("Consulta", "erp.catalog.products.view"))
	roleID := idOf(created)

	userID := testutil.NewUser(t, pool, "consulta@minimarket.test")
	if _, err := pool.Exec(context.Background(), `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, userID, roleID); err != nil {
		t.Fatal(err)
	}

	user := testutil.LoginAs(t, router, "consulta@minimarket.test")

	if code := testutil.Call(router, "GET", "/api/catalog/products", user, nil).Code; code != http.StatusOK {
		t.Fatalf("con el rol puede ver productos: %d", code)
	}

	// Se le quita el permiso al rol: el usuario lo pierde sin volver a iniciar sesión.
	code, body := send(router, "PUT", fmt.Sprintf("/api/roles/%d", roleID), admin,
		roleBody("Consulta renombrada", "pos.cash"))
	if code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d: %v", code, body)
	}

	if got := permissionsOf(body); len(got) != 1 || got[0] != "pos.cash" {
		t.Fatalf("los permisos debían reemplazarse: %v", got)
	}

	if code := testutil.Call(router, "GET", "/api/catalog/products", user, nil).Code; code != http.StatusForbidden {
		t.Fatalf("sin el permiso debía dar 403: %d", code)
	}

	if body["data"].(map[string]any)["user_count"] != float64(1) {
		t.Fatalf("el rol lo tiene un usuario: %v", body)
	}
}

func TestAdministratorRoleCannotBeChangedOrDeleted(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)
	id := adminRoleID(t, pool)

	if code, _ := send(router, "PUT", fmt.Sprintf("/api/roles/%d", id), token, roleBody("Otro nombre")); code != http.StatusConflict {
		t.Fatalf("editar el administrador esperaba 409, llegó %d", code)
	}

	if code, _ := send(router, "DELETE", fmt.Sprintf("/api/roles/%d", id), token, nil); code != http.StatusConflict {
		t.Fatalf("eliminar el administrador esperaba 409, llegó %d", code)
	}

	_, shown := send(router, "GET", fmt.Sprintf("/api/roles/%d", id), token, nil)
	if shown["data"].(map[string]any)["is_system"] != true {
		t.Fatalf("el administrador es un rol del sistema: %v", shown)
	}
}

func TestDeleteNeedsTheRoleToBeUnused(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	_, created := send(router, "POST", "/api/roles", token, roleBody("Temporal", "pos.cash"))
	roleID := idOf(created)

	userID := testutil.NewUser(t, pool, "usa-rol@minimarket.test")
	if _, err := pool.Exec(context.Background(), `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, userID, roleID); err != nil {
		t.Fatal(err)
	}

	url := fmt.Sprintf("/api/roles/%d", roleID)

	code, body := send(router, "DELETE", url, token, nil)
	if code != http.StatusConflict || body["context"].(map[string]any)["user_count"] != float64(1) {
		t.Fatalf("con usuarios esperaba 409 con su cantidad: %d %v", code, body)
	}

	if _, err := pool.Exec(context.Background(), `DELETE FROM user_roles WHERE role_id = $1`, roleID); err != nil {
		t.Fatal(err)
	}

	if code, _ := send(router, "DELETE", url, token, nil); code != http.StatusOK {
		t.Fatalf("sin usuarios se elimina: %d", code)
	}

	if code, _ := send(router, "GET", url, token, nil); code != http.StatusNotFound {
		t.Fatalf("ya no existe: %d", code)
	}
}

func TestListPaginatesBy20SearchesAndSorts(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	for i := 1; i <= 24; i++ {
		if code, body := send(router, "POST", "/api/roles", token, roleBody(fmt.Sprintf("Rol %02d", i))); code != http.StatusCreated {
			t.Fatalf("alta %d: %d %v", i, code, body)
		}
	}

	_, first := send(router, "GET", "/api/roles", token, nil)
	if len(first["data"].([]any)) != 20 {
		t.Fatalf("la primera página debe tener 20, tiene %d", len(first["data"].([]any)))
	}

	cursor := first["meta"].(map[string]any)["next_cursor"].(string)

	_, second := send(router, "GET", "/api/roles?cursor="+cursor, token, nil)
	if got := len(second["data"].([]any)); got != 5 { // 24 + Administrador - 20
		t.Fatalf("la segunda página debe tener 5, tiene %d", got)
	}

	_, found := send(router, "GET", "/api/roles?search=rol%2007", token, nil)
	if len(found["data"].([]any)) != 1 {
		t.Fatalf("la búsqueda debía dar 1 resultado: %v", found["data"])
	}

	if code, _ := send(router, "GET", "/api/roles?sort=description", token, nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("un orden no permitido esperaba 422, llegó %d", code)
	}
}

func TestEveryActionNeedsItsPermissionAndCatalogIsOpenToRoleManagers(t *testing.T) {
	router, pool := testutil.Router(t, "local")

	userID := testutil.NewUser(t, pool, "mira-roles@minimarket.test")
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO user_permissions (user_id, permission, effect) VALUES ($1, 'config.roles.roles.view', 'allow')`, userID); err != nil {
		t.Fatal(err)
	}

	viewer := testutil.LoginAs(t, router, "mira-roles@minimarket.test")

	if code, _ := send(router, "GET", "/api/roles", viewer, nil); code != http.StatusOK {
		t.Fatalf("con 'ver' puede listar: %d", code)
	}

	// El árbol de permisos lo necesita quien arma roles.
	if code, _ := send(router, "GET", "/api/permissions/catalog", viewer, nil); code != http.StatusOK {
		t.Fatalf("quien ve roles puede ver el catálogo: %d", code)
	}

	for _, request := range []struct{ method, path string }{
		{"POST", "/api/roles"}, {"PUT", "/api/roles/1"}, {"DELETE", "/api/roles/1"},
	} {
		if code, _ := send(router, request.method, request.path, viewer, map[string]any{}); code != http.StatusForbidden {
			t.Errorf("%s %s sin permiso esperaba 403, llegó %d", request.method, request.path, code)
		}
	}
}

// fieldKeys devuelve los campos de una fila como "a,b,c" (ordenados).
func fieldKeys(item any) string {
	keys := make([]string, 0)
	for key := range item.(map[string]any) {
		keys = append(keys, key)
	}

	sort.Strings(keys)

	return strings.Join(keys, ",")
}

func TestListOnlyReturnsTheRequestedFields(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	_, created := send(router, "POST", "/api/roles", token, roleBody("Vendedor", "pos.sales"))

	userID := testutil.NewUser(t, pool, "tiene-rol@minimarket.test")
	if _, err := pool.Exec(context.Background(), `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, userID, idOf(created)); err != nil {
		t.Fatal(err)
	}

	rows := func(query string) []any {
		_, body := send(router, "GET", "/api/roles"+query, token, nil)

		return body["data"].([]any)
	}

	for _, item := range rows("?fields=name") {
		if got := fieldKeys(item); got != "id,name" {
			t.Fatalf("solo nombre e id: %s", got)
		}
	}

	for _, item := range rows("?fields=name,user_count") {
		row := item.(map[string]any)
		if fieldKeys(item) != "id,name,user_count" {
			t.Fatalf("nombre, cuenta e id: %s", fieldKeys(item))
		}

		if row["name"] == "Vendedor" && row["user_count"] != float64(1) {
			t.Fatalf("pidiendo la cuenta debe venir calculada: %v", row)
		}
	}

	for _, item := range rows("?fields=name,permissions") {
		row := item.(map[string]any)
		if row["name"] == "Vendedor" && len(row["permissions"].([]any)) != 1 {
			t.Fatalf("pidiendo permisos deben venir calculados: %v", row)
		}
	}

	if code, _ := send(router, "GET", "/api/roles?fields=secret", token, nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("un campo que no existe esperaba 422, llegó %d", code)
	}
}
