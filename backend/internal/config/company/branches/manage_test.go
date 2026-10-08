package branches_test

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

func branchBody(code, name string) map[string]any {
	return map[string]any{"code": code, "name": name, "address": "Av. Principal 120"}
}

func idOf(body map[string]any) int64 {
	return int64(body["data"].(map[string]any)["id"].(float64))
}

func exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()

	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
}

func TestCreateBranchNormalizesAndStartsActive(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	body := branchBody(" c01 ", "  Sucursal Centro ")
	body["sunat_code"] = "0001"
	body["phone"] = "01 234 5678"

	code, created := send(router, "POST", "/api/branches", token, body)
	if code != http.StatusCreated {
		t.Fatalf("esperaba 201, llegó %d: %v", code, created)
	}

	branch := created["data"].(map[string]any)
	if branch["code"] != "C01" || branch["name"] != "Sucursal Centro" || branch["active"] != true ||
		branch["kind"] != "store" || branch["sunat_code"] != "0001" {
		t.Fatalf("sucursal inesperada: %v", branch)
	}
}

func TestCreateBranchRejectsBadAndRepeatedData(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	first := branchBody("C01", "Sucursal Centro")
	first["sunat_code"] = "0001"
	send(router, "POST", "/api/branches", token, first)

	if code, _ := send(router, "POST", "/api/branches", token, branchBody("c01", "Otra")); code != http.StatusConflict {
		t.Fatalf("código repetido (sin importar mayúsculas) esperaba 409, llegó %d", code)
	}

	repeatedSunat := branchBody("C02", "Otra")
	repeatedSunat["sunat_code"] = "0001"

	if code, _ := send(router, "POST", "/api/branches", token, repeatedSunat); code != http.StatusConflict {
		t.Fatalf("establecimiento SUNAT repetido esperaba 409, llegó %d", code)
	}

	for name, change := range map[string]map[string]any{
		"código con símbolos": {"code": "C 0#"},
		"código muy largo":    {"code": "ABCDEFGHIJK"},
		"sin nombre":          {"name": " "},
		"SUNAT mal escrito":   {"sunat_code": "12"},
		"teléfono inválido":   {"phone": "abc"},
		"tipo desconocido":    {"kind": "kiosco"},
	} {
		body := branchBody("C09", "Prueba")
		for key, value := range change {
			body[key] = value
		}

		if code, _ := send(router, "POST", "/api/branches", token, body); code != http.StatusUnprocessableEntity {
			t.Errorf("%s: esperaba 422, llegó %d", name, code)
		}
	}
}

func TestListPaginatesBy20SearchesAndFilters(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	for i := 1; i <= 24; i++ {
		body := branchBody(fmt.Sprintf("T%02d", i), fmt.Sprintf("Tienda %02d", i))
		if i == 24 {
			body["kind"] = "distribution"
			body["active"] = false
		}

		if code, created := send(router, "POST", "/api/branches", token, body); code != http.StatusCreated {
			t.Fatalf("alta %d: %d %v", i, code, created)
		}
	}

	_, first := send(router, "GET", "/api/branches", token, nil)
	if len(first["data"].([]any)) != 20 {
		t.Fatalf("la primera página debe tener 20, tiene %d", len(first["data"].([]any)))
	}

	cursor := first["meta"].(map[string]any)["next_cursor"].(string)

	_, second := send(router, "GET", "/api/branches?cursor="+cursor, token, nil)
	if len(second["data"].([]any)) != 4 {
		t.Fatalf("la segunda página debe tener 4, tiene %d", len(second["data"].([]any)))
	}

	_, found := send(router, "GET", "/api/branches?search=tienda%2007", token, nil)
	if len(found["data"].([]any)) != 1 {
		t.Fatalf("la búsqueda debía dar 1 resultado: %v", found["data"])
	}

	_, byCode := send(router, "GET", "/api/branches?search=t15", token, nil)
	if len(byCode["data"].([]any)) != 1 {
		t.Fatalf("buscar por código debía dar 1 resultado: %v", byCode["data"])
	}

	_, distribution := send(router, "GET", "/api/branches?kind=distribution", token, nil)
	if len(distribution["data"].([]any)) != 1 {
		t.Fatalf("el filtro por tipo debía dar 1: %v", distribution["data"])
	}

	_, inactive := send(router, "GET", "/api/branches?status=inactive", token, nil)
	if len(inactive["data"].([]any)) != 1 {
		t.Fatalf("el filtro por estado debía dar 1: %v", inactive["data"])
	}

	if code, _ := send(router, "GET", "/api/branches?sort=address", token, nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("un orden no permitido esperaba 422, llegó %d", code)
	}
}

func TestUpdateAndSummary(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	_, created := send(router, "POST", "/api/branches", token, branchBody("C01", "Sucursal Centro"))
	send(router, "POST", "/api/branches", token, map[string]any{"code": "CD1", "name": "Distribución", "kind": "distribution"})

	url := fmt.Sprintf("/api/branches/%d", idOf(created))

	code, updated := send(router, "PUT", url, token, map[string]any{
		"code": "C01", "name": "Centro Histórico", "kind": "store", "active": false,
	})
	if code != http.StatusOK || updated["data"].(map[string]any)["name"] != "Centro Histórico" ||
		updated["data"].(map[string]any)["active"] != false {
		t.Fatalf("edición inesperada: %d %v", code, updated)
	}

	_, summary := send(router, "GET", "/api/branches/summary", token, nil)
	data := summary["data"].(map[string]any)

	if data["active"] != float64(1) || data["inactive"] != float64(1) ||
		data["stores"] != float64(1) || data["distribution"] != float64(1) {
		t.Fatalf("resumen inesperado: %v", data)
	}

	if code, _ := send(router, "PUT", "/api/branches/99999", token, branchBody("X", "Y")); code != http.StatusNotFound {
		t.Fatalf("sucursal inexistente esperaba 404, llegó %d", code)
	}
}

func TestDeleteNeedsTheBranchToBeEmpty(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	_, withWarehouse := send(router, "POST", "/api/branches", token, branchBody("C01", "Con almacén"))
	exec(t, pool, `INSERT INTO warehouses (branch_id, code, name) VALUES ($1, 'ALM-01', 'Principal')`, idOf(withWarehouse))

	code, body := send(router, "DELETE", fmt.Sprintf("/api/branches/%d", idOf(withWarehouse)), token, nil)
	if code != http.StatusConflict || body["context"].(map[string]any)["warehouses"] != float64(1) {
		t.Fatalf("con almacenes esperaba 409: %d %v", code, body)
	}

	_, withUser := send(router, "POST", "/api/branches", token, branchBody("C02", "Con usuario"))
	userID := testutil.NewUser(t, pool, "asignado@minimarket.test")
	exec(t, pool, `INSERT INTO user_branches (user_id, branch_id) VALUES ($1, $2)`, userID, idOf(withUser))

	if code, _ := send(router, "DELETE", fmt.Sprintf("/api/branches/%d", idOf(withUser)), token, nil); code != http.StatusConflict {
		t.Fatalf("con usuarios asignados esperaba 409, llegó %d", code)
	}

	// Vacía, se elimina y deja libre su código.
	_, empty := send(router, "POST", "/api/branches", token, branchBody("C03", "Vacía"))
	url := fmt.Sprintf("/api/branches/%d", idOf(empty))

	if code, _ := send(router, "DELETE", url, token, nil); code != http.StatusOK {
		t.Fatalf("una sucursal vacía se elimina: %d", code)
	}

	if code, _ := send(router, "GET", url, token, nil); code != http.StatusNotFound {
		t.Fatalf("ya no existe: %d", code)
	}

	if code, _ := send(router, "POST", "/api/branches", token, branchBody("C03", "Nueva")); code != http.StatusCreated {
		t.Fatalf("el código de la eliminada queda libre: %d", code)
	}

	// Y la eliminada no sale en el selector de la cuenta.
	listed := testutil.Decode(t, testutil.Call(router, "GET", "/api/company/branches", token, nil))["data"].([]any)
	for _, item := range listed {
		if item.(map[string]any)["name"] == "Vacía" {
			t.Fatal("una sucursal eliminada no debe aparecer en el selector")
		}
	}
}

func TestEveryActionNeedsItsPermission(t *testing.T) {
	router, pool := testutil.Router(t, "local")

	userID := testutil.NewUser(t, pool, "mira-sucursales@minimarket.test")
	exec(t, pool, `INSERT INTO user_permissions (user_id, permission, effect) VALUES ($1, 'config.company.branches.view', 'allow')`, userID)

	viewer := testutil.LoginAs(t, router, "mira-sucursales@minimarket.test")

	if code, _ := send(router, "GET", "/api/branches", viewer, nil); code != http.StatusOK {
		t.Fatalf("con 'ver' puede listar: %d", code)
	}

	for _, request := range []struct{ method, path string }{
		{"POST", "/api/branches"}, {"PUT", "/api/branches/1"}, {"DELETE", "/api/branches/1"},
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

	_, created := send(router, "POST", "/api/branches", token, branchBody("C01", "Con almacén"))
	exec(t, pool, `INSERT INTO warehouses (branch_id, code, name) VALUES ($1, 'ALM-01', 'Principal')`, idOf(created))

	rows := func(query string) []any {
		_, body := send(router, "GET", "/api/branches"+query, token, nil)

		return body["data"].([]any)
	}

	for _, item := range rows("?fields=code,name") {
		if got := fieldKeys(item); got != "code,id,name" {
			t.Fatalf("código, nombre e id: %s", got)
		}
	}

	row := rows("?fields=name,warehouses,users")[0].(map[string]any)
	if fieldKeys(row) != "id,name,users,warehouses" || row["warehouses"] != float64(1) || row["users"] != float64(0) {
		t.Fatalf("pidiendo las cuentas deben venir calculadas: %v", row)
	}

	if code, _ := send(router, "GET", "/api/branches?fields=nope", token, nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("un campo que no existe esperaba 422, llegó %d", code)
	}
}
