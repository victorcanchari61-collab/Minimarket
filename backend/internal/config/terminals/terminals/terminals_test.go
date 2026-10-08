package terminals_test

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

func addBranch(t *testing.T, pool *pgxpool.Pool, code, name, kind string) int64 {
	t.Helper()

	var id int64

	err := pool.QueryRow(context.Background(), `
		INSERT INTO branches (company_id, code, name, kind) VALUES ((SELECT id FROM companies LIMIT 1), $1, $2, $3) RETURNING id`,
		code, name, kind).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}

	return id
}

func addWarehouse(t *testing.T, pool *pgxpool.Pool, branch int64, code string) int64 {
	t.Helper()

	var id int64

	err := pool.QueryRow(context.Background(), `
		INSERT INTO warehouses (branch_id, code, name) VALUES ($1, $2, $2) RETURNING id`, branch, code).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}

	return id
}

func body(branch int64, code, name string) map[string]any {
	return map[string]any{"branch_id": branch, "code": code, "name": name}
}

func idOf(response map[string]any) int64 {
	return int64(response["data"].(map[string]any)["id"].(float64))
}

func TestCreateNormalizesAndStartsActive(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	branch := addBranch(t, pool, "C01", "Sucursal Centro", "store")
	warehouse := addWarehouse(t, pool, branch, "ALM-01")

	request := body(branch, " caja-1 ", "  Caja principal ")
	request["warehouse_id"] = warehouse

	code, created := send(router, "POST", "/api/terminals", token, request)
	if code != http.StatusCreated {
		t.Fatalf("esperaba 201, llegó %d: %v", code, created)
	}

	terminal := created["data"].(map[string]any)
	if terminal["code"] != "CAJA-1" || terminal["name"] != "Caja principal" || terminal["active"] != true ||
		terminal["branch_name"] != "Sucursal Centro" || terminal["warehouse_name"] != "ALM-01" {
		t.Fatalf("terminal inesperada: %v", terminal)
	}
}

func TestRulesOfBranchWarehouseAndCode(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	centro := addBranch(t, pool, "C01", "Sucursal Centro", "store")
	norte := addBranch(t, pool, "C02", "Sucursal Norte", "store")
	cd := addBranch(t, pool, "CD1", "Centro de distribución", "distribution")
	almacenNorte := addWarehouse(t, pool, norte, "ALM-N")

	send(router, "POST", "/api/terminals", token, body(centro, "CAJA-1", "Caja 1"))

	if code, _ := send(router, "POST", "/api/terminals", token, body(centro, "caja-1", "Otra")); code != http.StatusConflict {
		t.Fatalf("mismo código en la misma sucursal esperaba 409, llegó %d", code)
	}

	if code, _ := send(router, "POST", "/api/terminals", token, body(norte, "CAJA-1", "Caja 1")); code != http.StatusCreated {
		t.Fatalf("otra sucursal puede repetir el código: %d", code)
	}

	wrongWarehouse := body(centro, "CAJA-2", "Caja 2")
	wrongWarehouse["warehouse_id"] = almacenNorte

	for name, request := range map[string]map[string]any{
		"centro de distribución":   body(cd, "CAJA-1", "Caja"),
		"sin sucursal":             body(0, "CAJA-2", "X"),
		"sucursal inexistente":     body(99999, "CAJA-2", "X"),
		"sin nombre":               body(centro, "CAJA-2", " "),
		"código con símbolos":      body(centro, "C A#", "X"),
		"almacén de otra sucursal": wrongWarehouse,
	} {
		if code, _ := send(router, "POST", "/api/terminals", token, request); code != http.StatusUnprocessableEntity {
			t.Errorf("%s: esperaba 422, llegó %d", name, code)
		}
	}
}

func TestListPaginatesBy20AndFilters(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	centro := addBranch(t, pool, "C01", "Sucursal Centro", "store")
	norte := addBranch(t, pool, "C02", "Sucursal Norte", "store")

	for i := 1; i <= 24; i++ {
		branch := centro
		if i > 20 {
			branch = norte
		}

		send(router, "POST", "/api/terminals", token, body(branch, fmt.Sprintf("T%02d", i), fmt.Sprintf("Caja %02d", i)))
	}

	_, first := send(router, "GET", "/api/terminals", token, nil)
	if len(first["data"].([]any)) != 20 {
		t.Fatalf("la primera página debe tener 20, tiene %d", len(first["data"].([]any)))
	}

	cursor := first["meta"].(map[string]any)["next_cursor"].(string)

	_, second := send(router, "GET", "/api/terminals?cursor="+cursor, token, nil)
	if len(second["data"].([]any)) != 4 {
		t.Fatalf("la segunda página debe tener 4, tiene %d", len(second["data"].([]any)))
	}

	_, ofNorte := send(router, "GET", fmt.Sprintf("/api/terminals?branch_id=%d", norte), token, nil)
	if len(ofNorte["data"].([]any)) != 4 {
		t.Fatalf("el filtro por sucursal debía dar 4: %v", len(ofNorte["data"].([]any)))
	}

	_, found := send(router, "GET", "/api/terminals?search=caja%2007", token, nil)
	if len(found["data"].([]any)) != 1 {
		t.Fatalf("la búsqueda debía dar 1: %v", found["data"])
	}

	if code, _ := send(router, "GET", "/api/terminals?sort=branch", token, nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("un orden no permitido esperaba 422, llegó %d", code)
	}
}

func TestUpdateDeleteAndSummary(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	centro := addBranch(t, pool, "C01", "Sucursal Centro", "store")
	addBranch(t, pool, "C02", "Sucursal Norte", "store") // sin cajas
	addBranch(t, pool, "CD1", "Centro de distribución", "distribution")

	_, created := send(router, "POST", "/api/terminals", token, body(centro, "CAJA-1", "Caja 1"))
	url := fmt.Sprintf("/api/terminals/%d", idOf(created))

	code, updated := send(router, "PUT", url, token, map[string]any{
		"branch_id": centro, "code": "CAJA-1", "name": "Caja rápida", "active": false,
	})
	if code != http.StatusOK || updated["data"].(map[string]any)["name"] != "Caja rápida" ||
		updated["data"].(map[string]any)["active"] != false {
		t.Fatalf("edición inesperada: %d %v", code, updated)
	}

	_, summary := send(router, "GET", "/api/terminals/summary", token, nil)
	data := summary["data"].(map[string]any)

	if data["active"] != float64(0) || data["inactive"] != float64(1) || data["stores_without"] != float64(2) {
		t.Fatalf("resumen inesperado (las dos tiendas quedan sin caja activa; el CD no cuenta): %v", data)
	}

	if code, _ := send(router, "DELETE", url, token, nil); code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d", code)
	}

	if code, _ := send(router, "GET", url, token, nil); code != http.StatusNotFound {
		t.Fatalf("ya no existe: %d", code)
	}

	if code, _ := send(router, "POST", "/api/terminals", token, body(centro, "CAJA-1", "Nueva")); code != http.StatusCreated {
		t.Fatalf("el código del eliminado queda libre: %d", code)
	}
}

func TestCannotDeleteWhileItHasSeries(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	centro := addBranch(t, pool, "C01", "Sucursal Centro", "store")

	_, created := send(router, "POST", "/api/terminals", token, body(centro, "CAJA-1", "Caja 1"))
	id := idOf(created)

	if _, err := pool.Exec(context.Background(), `
		INSERT INTO document_series (branch_id, terminal_id, document_type, series) VALUES ($1, $2, 'receipt', 'B001')`,
		centro, id); err != nil {
		t.Fatal(err)
	}

	if code, _ := send(router, "DELETE", fmt.Sprintf("/api/terminals/%d", id), token, nil); code != http.StatusConflict {
		t.Fatalf("con series asignadas esperaba 409, llegó %d", code)
	}
}

func TestLookupsAndPermissions(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	centro := addBranch(t, pool, "C01", "Sucursal Centro", "store")
	addBranch(t, pool, "CD1", "Centro de distribución", "distribution")
	addWarehouse(t, pool, centro, "ALM-01")

	_, branches := send(router, "GET", "/api/terminals/branches", admin, nil)
	if len(branches["data"].([]any)) != 1 {
		t.Fatalf("solo las tiendas pueden llevar cajas: %v", branches)
	}

	_, warehouses := send(router, "GET", "/api/terminals/warehouses", admin, nil)
	if len(warehouses["data"].([]any)) != 1 {
		t.Fatalf("el formulario debía traer el almacén: %v", warehouses)
	}

	userID := testutil.NewUser(t, pool, "mira-cajas@minimarket.test")
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO user_permissions (user_id, permission, effect) VALUES ($1, 'config.terminals.pos_terminals.view', 'allow')`, userID); err != nil {
		t.Fatal(err)
	}

	viewer := testutil.LoginAs(t, router, "mira-cajas@minimarket.test")

	if code, _ := send(router, "GET", "/api/terminals", viewer, nil); code != http.StatusOK {
		t.Fatalf("con 'ver' puede listar: %d", code)
	}

	for _, request := range []struct{ method, path string }{
		{"POST", "/api/terminals"}, {"PUT", "/api/terminals/1"}, {"DELETE", "/api/terminals/1"},
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

	send(router, "POST", "/api/terminals", token, body(addBranch(t, pool, "C01", "Sucursal Centro", "store"), "CAJA-1", "Caja 1"))

	_, list := send(router, "GET", "/api/terminals?fields=code,branch_name", token, nil)
	for _, item := range list["data"].([]any) {
		if got := fieldKeys(item); got != "branch_name,code,id" {
			t.Fatalf("código, sucursal e id: %s", got)
		}
	}

	if code, _ := send(router, "GET", "/api/terminals?fields=nope", token, nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("un campo que no existe esperaba 422, llegó %d", code)
	}
}
