package catalog_test

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"minimarket/backend/internal/erp/catalog"
	"minimarket/backend/internal/testutil"
)

type fixture struct {
	pool   *pgxpool.Pool
	t      *testing.T
	router *gin.Engine
	token  string
	unitID float64
}

func newFixture(t *testing.T) *fixture {
	t.Helper()

	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	rec := testutil.Call(router, "GET", "/api/catalog/units", token, nil)
	units := testutil.Decode(t, rec)["data"].([]any)

	return &fixture{pool: pool, t: t, router: router, token: token, unitID: units[0].(map[string]any)["id"].(float64)}
}

func (f *fixture) call(method, path string, body any) map[string]any {
	f.t.Helper()

	rec := testutil.Call(f.router, method, path, f.token, body)

	return testutil.Decode(f.t, rec)
}

func (f *fixture) status(method, path string, body any) int {
	return testutil.Call(f.router, method, path, f.token, body).Code
}

func (f *fixture) product(sku, name, price string, extra map[string]any) map[string]any {
	f.t.Helper()

	body := map[string]any{"sku": sku, "name": name, "unit_id": f.unitID, "price": price}
	for k, v := range extra {
		body[k] = v
	}

	rec := testutil.Call(f.router, "POST", "/api/catalog/products", f.token, body)
	if rec.Code != http.StatusCreated {
		f.t.Fatalf("no se pudo crear %s: %d %s", sku, rec.Code, rec.Body.String())
	}

	return testutil.Decode(f.t, rec)["data"].(map[string]any)
}

// pages recorre TODAS las páginas de un listado y devuelve las filas y cuántas
// peticiones hicieron falta.
func (f *fixture) pages(query string) ([]map[string]any, int) {
	f.t.Helper()

	var (
		rows     []map[string]any
		requests int
		cursor   string
	)

	for {
		path := "/api/catalog/products?" + query
		if cursor != "" {
			path += "&cursor=" + url.QueryEscape(cursor)
		}

		body := f.call("GET", path, nil)
		requests++

		data := body["data"].([]any)
		if len(data) > 20 {
			f.t.Fatalf("una página devolvió %d filas (máximo 20)", len(data))
		}

		for _, row := range data {
			rows = append(rows, row.(map[string]any))
		}

		meta := body["meta"].(map[string]any)
		if meta["per_page"].(float64) != 20 {
			f.t.Fatalf("per_page debe ser 20: %v", meta["per_page"])
		}

		next, _ := meta["next_cursor"].(string)
		if next == "" {
			return rows, requests
		}

		cursor = next

		if requests > 20 {
			f.t.Fatal("el cursor no avanza")
		}
	}
}

func TestProductsRequireLogin(t *testing.T) {
	router, _ := testutil.Router(t, "local")

	for _, path := range []string{"/api/catalog/products", "/api/catalog/categories", "/api/catalog/units"} {
		if rec := testutil.Call(router, "GET", path, "", nil); rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s sin sesión esperaba 401, llegó %d", path, rec.Code)
		}
	}
}

func TestCreateShowUpdateAndDelete(t *testing.T) {
	f := newFixture(t)

	created := f.product("ARR-5KG", "Arroz extra 5 kg", "24.90", nil)
	id := int64(created["id"].(float64))

	if created["price"] != "24.90" || created["status"] != "active" || created["status_label"] != "Activo" {
		t.Fatalf("producto creado inesperado: %v", created)
	}

	shown := f.call("GET", fmt.Sprintf("/api/catalog/products/%d", id), nil)["data"].(map[string]any)
	if shown["sku"] != "ARR-5KG" {
		t.Fatalf("show inesperado: %v", shown)
	}

	updated := f.call("PUT", fmt.Sprintf("/api/catalog/products/%d", id), map[string]any{
		"sku": "ARR-5KG", "name": "Arroz extra 5 kg (saco)", "unit_id": f.unitID, "price": "26.50", "status": "inactive",
	})["data"].(map[string]any)

	if updated["name"] != "Arroz extra 5 kg (saco)" || updated["price"] != "26.50" || updated["status"] != "inactive" {
		t.Fatalf("actualización inesperada: %v", updated)
	}

	if code := f.status("DELETE", fmt.Sprintf("/api/catalog/products/%d", id), nil); code != http.StatusOK {
		t.Fatalf("delete esperaba 200, llegó %d", code)
	}

	if code := f.status("GET", fmt.Sprintf("/api/catalog/products/%d", id), nil); code != http.StatusNotFound {
		t.Fatalf("tras eliminar esperaba 404, llegó %d", code)
	}

	// El SKU de un producto eliminado queda libre.
	f.product("ARR-5KG", "Arroz extra 5 kg", "24.90", nil)
}

func TestDuplicateSKUIsRejectedIgnoringCase(t *testing.T) {
	f := newFixture(t)
	f.product("ABC-1", "Primero", "1.00", nil)

	rec := testutil.Call(f.router, "POST", "/api/catalog/products", f.token, map[string]any{
		"sku": "abc-1", "name": "Segundo", "unit_id": f.unitID, "price": "2.00",
	})

	if rec.Code != http.StatusConflict {
		t.Fatalf("esperaba 409, llegó %d: %s", rec.Code, rec.Body.String())
	}

	body := testutil.Decode(t, rec)
	if body["code"] != "CONFLICT" {
		t.Fatalf("código inesperado: %v", body["code"])
	}

	if _, ok := body["errors"].(map[string]any)["sku"]; !ok {
		t.Fatalf("falta el error del campo sku: %v", body)
	}
}

func TestProductValidation(t *testing.T) {
	f := newFixture(t)

	cases := []struct {
		name  string
		body  map[string]any
		field string
	}{
		{"sin campos", map[string]any{}, "sku"},
		{"precio con letras", map[string]any{"sku": "A", "name": "A", "unit_id": f.unitID, "price": "abc"}, "price"},
		{"precio con tres decimales", map[string]any{"sku": "A", "name": "A", "unit_id": f.unitID, "price": "1.234"}, "price"},
		{"unidad inexistente", map[string]any{"sku": "A", "name": "A", "unit_id": 999999, "price": "1"}, "unit_id"},
		{"categoría inexistente", map[string]any{"sku": "A", "name": "A", "unit_id": f.unitID, "price": "1", "category_id": 999999}, "category_id"},
		{"estado inválido", map[string]any{"sku": "A", "name": "A", "unit_id": f.unitID, "price": "1", "status": "raro"}, "status"},
		{"nombre en blanco", map[string]any{"sku": "A", "name": "   ", "unit_id": f.unitID, "price": "1"}, "name"},
	}

	for _, tc := range cases {
		rec := testutil.Call(f.router, "POST", "/api/catalog/products", f.token, tc.body)
		if rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("%s: esperaba 422, llegó %d (%s)", tc.name, rec.Code, rec.Body.String())
		}

		errs := testutil.Decode(t, rec)["errors"].(map[string]any)
		if _, ok := errs[tc.field]; !ok {
			t.Fatalf("%s: falta el error de %q: %v", tc.name, tc.field, errs)
		}
	}
}

func TestListingIsPaginatedByCursorInTwenties(t *testing.T) {
	f := newFixture(t)

	for i := 1; i <= 45; i++ {
		f.product(fmt.Sprintf("SKU-%03d", i), fmt.Sprintf("Producto %03d", i), "1.00", nil)
	}

	rows, requests := f.pages("")

	if len(rows) != 45 || requests != 3 {
		t.Fatalf("esperaba 45 filas en 3 peticiones, llegaron %d en %d", len(rows), requests)
	}

	seen := map[float64]bool{}
	for _, row := range rows {
		id := row["id"].(float64)
		if seen[id] {
			t.Fatalf("la fila %v se repitió entre páginas", id)
		}

		seen[id] = true
	}
}

func TestSortingDescendingKeepsOrderAcrossPages(t *testing.T) {
	f := newFixture(t)

	for i := 1; i <= 45; i++ {
		// precios repetidos a propósito: el desempate por id debe sostener el cursor
		f.product(fmt.Sprintf("P-%03d", i), fmt.Sprintf("Producto %03d", i), fmt.Sprintf("%d.50", i%7+1), nil)
	}

	rows, _ := f.pages("sort=price&direction=desc")

	if len(rows) != 45 {
		t.Fatalf("esperaba 45 filas, llegaron %d", len(rows))
	}

	prices := make([]string, len(rows))
	for i, row := range rows {
		prices[i] = row["price"].(string)
	}

	if !sort.SliceIsSorted(prices, func(i, j int) bool { return prices[i] > prices[j] }) {
		t.Fatalf("los precios no vienen de mayor a menor: %v", prices)
	}
}

func TestFilters(t *testing.T) {
	f := newFixture(t)

	categoryID, err := catalog.NewStore(f.pool).EnsureCategory(context.Background(), "Bebidas calientes")
	if err != nil {
		t.Fatal(err)
	}

	f.product("CAF-1", "Café molido 250 g", "12.00", map[string]any{"category_id": categoryID})
	f.product("CAF-2", "Cafetera eléctrica", "99.00", map[string]any{"status": "inactive"})
	f.product("TE-1", "Té verde", "5.00", nil)

	count := func(query string) int {
		rows, _ := f.pages(query)

		return len(rows)
	}

	if n := count("search=cafe"); n != 2 { // sin distinguir acentos
		t.Fatalf("search=cafe esperaba 2, llegó %d", n)
	}

	if n := count("search=CAF-"); n != 2 { // por prefijo del SKU
		t.Fatalf("search por SKU esperaba 2, llegó %d", n)
	}

	if n := count("status=inactive"); n != 1 {
		t.Fatalf("status=inactive esperaba 1, llegó %d", n)
	}

	if n := count("price_from=10&price_to=50"); n != 1 {
		t.Fatalf("rango de precio esperaba 1, llegó %d", n)
	}

	if n := count("name=te"); n < 1 {
		t.Fatalf("name contiene 'te' esperaba al menos 1, llegó %d", n)
	}

	if n := count(fmt.Sprintf("category_id=%d", categoryID)); n != 1 {
		t.Fatalf("filtro por categoría esperaba 1, llegó %d", n)
	}

	if n := count("sku=TE-"); n != 1 {
		t.Fatalf("sku contiene 'TE-' esperaba 1, llegó %d", n)
	}
}

func TestSearchNeedsTwoCharactersAndWildcardsAreLiteral(t *testing.T) {
	f := newFixture(t)
	f.product("A-1", "Producto 100% natural", "1.00", nil)
	f.product("A-2", "Producto normal", "1.00", nil)

	if code := f.status("GET", "/api/catalog/products?search=a", nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("un solo carácter esperaba 422, llegó %d", code)
	}

	rows, _ := f.pages("search=" + url.QueryEscape("100%"))
	if len(rows) != 1 {
		t.Fatalf("el %% debe buscarse como texto: esperaba 1, llegó %d", len(rows))
	}

	rows, _ = f.pages("search=" + url.QueryEscape("%%"))
	if len(rows) != 0 {
		t.Fatalf("%%%% no debe actuar como comodín: llegó %d", len(rows))
	}
}

func TestCursorFromAnotherSortIsRejectedAndSortIsWhitelisted(t *testing.T) {
	f := newFixture(t)

	for i := 1; i <= 25; i++ {
		f.product(fmt.Sprintf("S-%03d", i), fmt.Sprintf("Prod %03d", i), "1.00", nil)
	}

	first := f.call("GET", "/api/catalog/products?sort=name", nil)
	next := first["meta"].(map[string]any)["next_cursor"].(string)

	if code := f.status("GET", "/api/catalog/products?sort=price&cursor="+url.QueryEscape(next), nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("cursor de otro orden esperaba 422, llegó %d", code)
	}

	if code := f.status("GET", "/api/catalog/products?cursor=basura", nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("cursor inventado esperaba 422, llegó %d", code)
	}

	if code := f.status("GET", "/api/catalog/products?sort=password", nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("orden fuera de la lista blanca esperaba 422, llegó %d", code)
	}
}

func TestSummaryCountsActiveInactiveAndCategories(t *testing.T) {
	f := newFixture(t)
	f.product("U-1", "Uno", "1.00", nil)
	f.product("U-2", "Dos", "1.00", map[string]any{"status": "inactive"})
	f.product("U-3", "Tres", "1.00", nil)

	data := f.call("GET", "/api/catalog/products/summary", nil)["data"].(map[string]any)

	if data["active"].(float64) != 2 || data["inactive"].(float64) != 1 || data["categories"].(float64) != 0 {
		t.Fatalf("resumen inesperado: %v", data)
	}
}
