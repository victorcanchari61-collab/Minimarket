package branches_test

import (
	"context"
	"net/http"
	"testing"

	"minimarket/backend/internal/testutil"
)

func TestListReturnsOnlyActiveBranchesByName(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	_, err := pool.Exec(context.Background(), `
		INSERT INTO branches (company_id, code, name, kind, active)
		SELECT (SELECT id FROM companies LIMIT 1), v.* FROM (VALUES
			('C02', 'Sucursal Norte', 'store', TRUE),
			('C01', 'Sucursal Centro', 'store', TRUE),
			('CD1', 'Centro de distribución', 'distribution', TRUE),
			('C99', 'Sucursal Cerrada', 'store', FALSE)) AS v`)
	if err != nil {
		t.Fatal(err)
	}

	rec := testutil.Call(router, "GET", "/api/company/branches", token, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d: %s", rec.Code, rec.Body.String())
	}

	data := testutil.Decode(t, rec)["data"].([]any)
	if len(data) != 3 {
		t.Fatalf("esperaba 3 sucursales activas, llegaron %d", len(data))
	}

	first := data[0].(map[string]any)
	if first["name"] != "Centro de distribución" || first["kind_label"] != "Centro de distribución" {
		t.Fatalf("orden o tipo inesperado: %v", first)
	}

	if data[1].(map[string]any)["name"] != "Sucursal Centro" {
		t.Fatalf("debían ir por nombre: %v", data)
	}
}

func TestListNeedsASession(t *testing.T) {
	router, _ := testutil.Router(t, "local")

	if code := testutil.Call(router, "GET", "/api/company/branches", "", nil).Code; code != http.StatusUnauthorized {
		t.Fatalf("sin sesión esperaba 401, llegó %d", code)
	}
}
