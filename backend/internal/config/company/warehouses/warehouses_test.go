package warehouses_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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

func addBranch(t *testing.T, pool *pgxpool.Pool, code, name string) int64 {
	t.Helper()

	var id int64

	err := pool.QueryRow(context.Background(), `
		INSERT INTO branches (company_id, code, name) VALUES ((SELECT id FROM companies LIMIT 1), $1, $2) RETURNING id`,
		code, name).Scan(&id)
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

func TestCreateWarehouseNormalizesAndStartsActive(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	branch := addBranch(t, pool, "C01", "Sucursal Centro")

	code, created := send(router, "POST", "/api/warehouses", token, body(branch, " alm-01 ", "  Almacén principal "))
	if code != http.StatusCreated {
		t.Fatalf("esperaba 201, llegó %d: %v", code, created)
	}

	warehouse := created["data"].(map[string]any)
	if warehouse["code"] != "ALM-01" || warehouse["name"] != "Almacén principal" ||
		warehouse["active"] != true || warehouse["branch_name"] != "Sucursal Centro" {
		t.Fatalf("almacén inesperado: %v", warehouse)
	}
}

func TestCodeIsUniquePerBranchAndDataIsValidated(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	centro := addBranch(t, pool, "C01", "Sucursal Centro")
	norte := addBranch(t, pool, "C02", "Sucursal Norte")

	send(router, "POST", "/api/warehouses", token, body(centro, "ALM-01", "Principal"))

	if code, _ := send(router, "POST", "/api/warehouses", token, body(centro, "alm-01", "Otro")); code != http.StatusConflict {
		t.Fatalf("mismo código en la misma sucursal esperaba 409, llegó %d", code)
	}

	// Otra sucursal puede usar el mismo código.
	if code, _ := send(router, "POST", "/api/warehouses", token, body(norte, "ALM-01", "Principal")); code != http.StatusCreated {
		t.Fatalf("otra sucursal puede repetir el código: %d", code)
	}

	for name, request := range map[string]map[string]any{
		"sin sucursal":         body(0, "ALM-02", "X"),
		"sucursal inexistente": body(99999, "ALM-02", "X"),
		"sin nombre":           body(centro, "ALM-02", " "),
		"código con símbolos":  body(centro, "A L#", "X"),
	} {
		if code, _ := send(router, "POST", "/api/warehouses", token, request); code != http.StatusUnprocessableEntity {
			t.Errorf("%s: esperaba 422, llegó %d", name, code)
		}
	}
}

func TestListPaginatesBy20AndFilters(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	centro := addBranch(t, pool, "C01", "Sucursal Centro")
	norte := addBranch(t, pool, "C02", "Sucursal Norte")

	for i := 1; i <= 24; i++ {
		branch := centro
		if i > 20 {
			branch = norte
		}

		send(router, "POST", "/api/warehouses", token, body(branch, fmt.Sprintf("A%02d", i), fmt.Sprintf("Almacén %02d", i)))
	}

	_, first := send(router, "GET", "/api/warehouses", token, nil)
	if len(first["data"].([]any)) != 20 {
		t.Fatalf("la primera página debe tener 20, tiene %d", len(first["data"].([]any)))
	}

	cursor := first["meta"].(map[string]any)["next_cursor"].(string)

	_, second := send(router, "GET", "/api/warehouses?cursor="+cursor, token, nil)
	if len(second["data"].([]any)) != 4 {
		t.Fatalf("la segunda página debe tener 4, tiene %d", len(second["data"].([]any)))
	}

	_, ofNorte := send(router, "GET", fmt.Sprintf("/api/warehouses?branch_id=%d", norte), token, nil)
	if len(ofNorte["data"].([]any)) != 4 {
		t.Fatalf("el filtro por sucursal debía dar 4: %v", len(ofNorte["data"].([]any)))
	}

	_, found := send(router, "GET", "/api/warehouses?search=almacen%2007", token, nil)
	if len(found["data"].([]any)) != 1 {
		t.Fatalf("la búsqueda sin acentos debía dar 1: %v", found["data"])
	}

	if code, _ := send(router, "GET", "/api/warehouses?sort=branch", token, nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("un orden no permitido esperaba 422, llegó %d", code)
	}
}

func TestUpdateDeleteAndSummary(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	centro := addBranch(t, pool, "C01", "Sucursal Centro")
	addBranch(t, pool, "C02", "Sucursal Norte") // sin almacenes

	_, created := send(router, "POST", "/api/warehouses", token, body(centro, "ALM-01", "Principal"))
	url := fmt.Sprintf("/api/warehouses/%d", idOf(created))

	code, updated := send(router, "PUT", url, token, map[string]any{
		"branch_id": centro, "code": "ALM-01", "name": "Almacén frío", "active": false,
	})
	if code != http.StatusOK || updated["data"].(map[string]any)["name"] != "Almacén frío" ||
		updated["data"].(map[string]any)["active"] != false {
		t.Fatalf("edición inesperada: %d %v", code, updated)
	}

	_, summary := send(router, "GET", "/api/warehouses/summary", token, nil)
	data := summary["data"].(map[string]any)

	if data["active"] != float64(0) || data["inactive"] != float64(1) || data["branches_without"] != float64(1) {
		t.Fatalf("resumen inesperado (Norte no tiene almacén; Centro sí): %v", data)
	}

	if code, _ := send(router, "DELETE", url, token, nil); code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d", code)
	}

	if code, _ := send(router, "GET", url, token, nil); code != http.StatusNotFound {
		t.Fatalf("ya no existe: %d", code)
	}

	if code, _ := send(router, "POST", "/api/warehouses", token, body(centro, "ALM-01", "Nuevo")); code != http.StatusCreated {
		t.Fatalf("el código del eliminado queda libre: %d", code)
	}
}

func TestBranchesLookupAndPermissions(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	addBranch(t, pool, "C01", "Sucursal Centro")

	_, lookup := send(router, "GET", "/api/warehouses/branches", admin, nil)
	if len(lookup["data"].([]any)) != 1 {
		t.Fatalf("la lista del formulario debía traer la sucursal: %v", lookup)
	}

	userID := testutil.NewUser(t, pool, "mira-almacenes@minimarket.test")
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO user_permissions (user_id, permission, effect) VALUES ($1, 'config.company.warehouses.view', 'allow')`, userID); err != nil {
		t.Fatal(err)
	}

	viewer := testutil.LoginAs(t, router, "mira-almacenes@minimarket.test")

	if code, _ := send(router, "GET", "/api/warehouses", viewer, nil); code != http.StatusOK {
		t.Fatalf("con 'ver' puede listar: %d", code)
	}

	for _, request := range []struct{ method, path string }{
		{"POST", "/api/warehouses"}, {"PUT", "/api/warehouses/1"}, {"DELETE", "/api/warehouses/1"},
	} {
		if code, _ := send(router, request.method, request.path, viewer, map[string]any{}); code != http.StatusForbidden {
			t.Errorf("%s %s sin permiso esperaba 403, llegó %d", request.method, request.path, code)
		}
	}
}
