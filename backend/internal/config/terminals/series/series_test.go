package series_test

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

func addTerminal(t *testing.T, pool *pgxpool.Pool, branch int64, code string) int64 {
	t.Helper()

	var id int64

	err := pool.QueryRow(context.Background(), `
		INSERT INTO pos_terminals (branch_id, code, name) VALUES ($1, $2, $2) RETURNING id`, branch, code).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}

	return id
}

func body(branch int64, kind, series string) map[string]any {
	return map[string]any{"branch_id": branch, "document_type": kind, "series": series}
}

func idOf(response map[string]any) int64 {
	return int64(response["data"].(map[string]any)["id"].(float64))
}

func TestCreateNormalizesAndStartsAtOne(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	branch := addBranch(t, pool, "C01", "Sucursal Centro", "store")
	terminal := addTerminal(t, pool, branch, "CAJA-1")

	request := body(branch, "receipt", " b001 ")
	request["terminal_id"] = terminal

	code, created := send(router, "POST", "/api/document-series", token, request)
	if code != http.StatusCreated {
		t.Fatalf("esperaba 201, llegó %d: %v", code, created)
	}

	item := created["data"].(map[string]any)
	if item["series"] != "B001" || item["next_number"] != float64(1) || item["used"] != false ||
		item["active"] != true || item["terminal_name"] != "CAJA-1" {
		t.Fatalf("serie inesperada: %v", item)
	}

	request = body(branch, "invoice", "F001")
	request["next_number"] = 150

	_, migrated := send(router, "POST", "/api/document-series", token, request)
	if migrated["data"].(map[string]any)["next_number"] != float64(150) || migrated["data"].(map[string]any)["used"] != true {
		t.Fatalf("una numeración que continúa arranca donde se indicó: %v", migrated)
	}
}

func TestSeriesRulesBySunat(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	centro := addBranch(t, pool, "C01", "Sucursal Centro", "store")
	norte := addBranch(t, pool, "C02", "Sucursal Norte", "store")
	terminalNorte := addTerminal(t, pool, norte, "CAJA-N")

	if code, _ := send(router, "POST", "/api/document-series", token, body(centro, "invoice", "F001")); code != http.StatusCreated {
		t.Fatalf("factura F001: %d", code)
	}

	if code, _ := send(router, "POST", "/api/document-series", token, body(norte, "invoice", "f001")); code != http.StatusConflict {
		t.Fatalf("la misma serie del mismo tipo esperaba 409, llegó %d", code)
	}

	if code, _ := send(router, "POST", "/api/document-series", token, body(norte, "receipt", "F001")); code == http.StatusConflict {
		t.Fatalf("otro tipo puede tener su propia serie (aunque esta no sea válida para boleta): %d", code)
	}

	wrongTerminal := body(centro, "receipt", "B002")
	wrongTerminal["terminal_id"] = terminalNorte

	for name, request := range map[string]map[string]any{
		"factura con letra de boleta": body(centro, "invoice", "B001"),
		"boleta con letra de factura": body(centro, "receipt", "F009"),
		"guía con letra de factura":   body(centro, "dispatch_guide", "F001"),
		"tres caracteres":             body(centro, "receipt", "B01"),
		"con símbolos":                body(centro, "receipt", "B-01"),
		"terminal de otra sucursal":   wrongTerminal,
		"sucursal inexistente":        body(99999, "receipt", "B003"),
	} {
		if code, _ := send(router, "POST", "/api/document-series", token, request); code != http.StatusUnprocessableEntity {
			t.Errorf("%s: esperaba 422, llegó %d", name, code)
		}
	}

	for kind, series := range map[string]string{
		"credit_note": "FC01", "debit_note": "BD01", "dispatch_guide": "T001",
	} {
		if code, out := send(router, "POST", "/api/document-series", token, body(centro, kind, series)); code != http.StatusCreated {
			t.Errorf("%s %s esperaba 201, llegó %d: %v", kind, series, code, out)
		}
	}
}

func TestUsedSeriesCannotChangeOrBeDeleted(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	branch := addBranch(t, pool, "C01", "Sucursal Centro", "store")

	_, fresh := send(router, "POST", "/api/document-series", token, body(branch, "receipt", "B001"))
	freshURL := fmt.Sprintf("/api/document-series/%d", idOf(fresh))

	// Sin usar: se puede corregir el código.
	code, fixed := send(router, "PUT", freshURL, token, body(branch, "receipt", "B002"))
	if code != http.StatusOK || fixed["data"].(map[string]any)["series"] != "B002" {
		t.Fatalf("una serie sin usar se corrige: %d %v", code, fixed)
	}

	_, used := send(router, "POST", "/api/document-series", token, map[string]any{
		"branch_id": branch, "document_type": "invoice", "series": "F001", "next_number": 40,
	})
	usedURL := fmt.Sprintf("/api/document-series/%d", idOf(used))

	if code, _ := send(router, "PUT", usedURL, token, body(branch, "invoice", "F002")); code != http.StatusConflict {
		t.Fatalf("cambiar el código de una serie usada esperaba 409, llegó %d", code)
	}

	if code, _ := send(router, "DELETE", usedURL, token, nil); code != http.StatusConflict {
		t.Fatalf("eliminar una serie usada esperaba 409, llegó %d", code)
	}

	deactivate := body(branch, "invoice", "F001")
	deactivate["active"] = false

	code, off := send(router, "PUT", usedURL, token, deactivate)
	if code != http.StatusOK || off["data"].(map[string]any)["active"] != false ||
		off["data"].(map[string]any)["next_number"] != float64(40) {
		t.Fatalf("desactivar sí se puede y el correlativo no cambia: %d %v", code, off)
	}

	if code, _ := send(router, "DELETE", freshURL, token, nil); code != http.StatusOK {
		t.Fatalf("eliminar una serie sin usar esperaba 200, llegó %d", code)
	}

	if code, _ := send(router, "POST", "/api/document-series", token, body(branch, "receipt", "B002")); code != http.StatusCreated {
		t.Fatalf("el código de la serie eliminada queda libre: %d", code)
	}
}

func TestListPaginatesBy20FiltersAndSummary(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	centro := addBranch(t, pool, "C01", "Sucursal Centro", "store")
	norte := addBranch(t, pool, "C02", "Sucursal Norte", "store")

	for i := 1; i <= 24; i++ {
		branch := centro
		if i > 20 {
			branch = norte
		}

		send(router, "POST", "/api/document-series", token, body(branch, "receipt", fmt.Sprintf("B%03d", i)))
	}

	_, first := send(router, "GET", "/api/document-series", token, nil)
	if len(first["data"].([]any)) != 20 {
		t.Fatalf("la primera página debe tener 20, tiene %d", len(first["data"].([]any)))
	}

	cursor := first["meta"].(map[string]any)["next_cursor"].(string)

	_, second := send(router, "GET", "/api/document-series?cursor="+cursor, token, nil)
	if len(second["data"].([]any)) != 4 {
		t.Fatalf("la segunda página debe tener 4, tiene %d", len(second["data"].([]any)))
	}

	_, ofNorte := send(router, "GET", fmt.Sprintf("/api/document-series?branch_id=%d", norte), token, nil)
	if len(ofNorte["data"].([]any)) != 4 {
		t.Fatalf("el filtro por sucursal debía dar 4: %v", len(ofNorte["data"].([]any)))
	}

	_, found := send(router, "GET", "/api/document-series?search=b007", token, nil)
	if len(found["data"].([]any)) != 1 {
		t.Fatalf("la búsqueda debía dar 1: %v", found["data"])
	}

	_, none := send(router, "GET", "/api/document-series?document_type=invoice", token, nil)
	if len(none["data"].([]any)) != 0 {
		t.Fatalf("no hay facturas: %v", none["data"])
	}

	_, summary := send(router, "GET", "/api/document-series/summary", token, nil)
	if data := summary["data"].(map[string]any); data["active"] != float64(24) || data["used"] != float64(0) {
		t.Fatalf("resumen inesperado: %v", data)
	}

	if code, _ := send(router, "GET", "/api/document-series?sort=terminal", token, nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("un orden no permitido esperaba 422, llegó %d", code)
	}
}

func TestLookupsPermissionsAndFields(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	branch := addBranch(t, pool, "C01", "Sucursal Centro", "store")
	addBranch(t, pool, "CD1", "Centro de distribución", "distribution") // las guías sí van en un CD
	addTerminal(t, pool, branch, "CAJA-1")
	send(router, "POST", "/api/document-series", admin, body(branch, "receipt", "B001"))

	_, branches := send(router, "GET", "/api/document-series/branches", admin, nil)
	if len(branches["data"].([]any)) != 2 {
		t.Fatalf("tienda y CD llevan series: %v", branches)
	}

	_, terminals := send(router, "GET", "/api/document-series/terminals", admin, nil)
	if len(terminals["data"].([]any)) != 1 {
		t.Fatalf("el formulario debía traer la terminal: %v", terminals)
	}

	_, list := send(router, "GET", "/api/document-series?fields=series,branch_name", admin, nil)
	for _, item := range list["data"].([]any) {
		keys := make([]string, 0)
		for key := range item.(map[string]any) {
			keys = append(keys, key)
		}

		sort.Strings(keys)

		if got := strings.Join(keys, ","); got != "branch_name,id,series" {
			t.Fatalf("serie, sucursal e id: %s", got)
		}
	}

	userID := testutil.NewUser(t, pool, "mira-series@minimarket.test")
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO user_permissions (user_id, permission, effect) VALUES ($1, 'config.terminals.series.view', 'allow')`, userID); err != nil {
		t.Fatal(err)
	}

	viewer := testutil.LoginAs(t, router, "mira-series@minimarket.test")

	if code, _ := send(router, "GET", "/api/document-series", viewer, nil); code != http.StatusOK {
		t.Fatalf("con 'ver' puede listar: %d", code)
	}

	for _, request := range []struct{ method, path string }{
		{"POST", "/api/document-series"}, {"PUT", "/api/document-series/1"}, {"DELETE", "/api/document-series/1"},
	} {
		if code, _ := send(router, request.method, request.path, viewer, map[string]any{}); code != http.StatusForbidden {
			t.Errorf("%s %s sin permiso esperaba 403, llegó %d", request.method, request.path, code)
		}
	}
}
