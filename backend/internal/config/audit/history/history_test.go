package history_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"testing"
	"time"

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

// add anota una línea del historial «hace daysAgo días».
func add(t *testing.T, pool *pgxpool.Pool, daysAgo int, userName, action, entity, label string) {
	t.Helper()

	_, err := pool.Exec(context.Background(), `
		INSERT INTO audit_log (at, user_name, user_email, action, entity, label, method)
		VALUES (now() - make_interval(days => $1), $2, lower($2) || '@minimarket.test', $3, $4, $5, 'POST')`,
		daysAgo, userName, action, entity, label)
	if err != nil {
		t.Fatal(err)
	}
}

// clean deja el historial vacío: iniciar sesión también deja líneas.
func clean(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	if _, err := pool.Exec(context.Background(), `DELETE FROM audit_log`); err != nil {
		t.Fatal(err)
	}
}

func count(response map[string]any) int { return len(response["data"].([]any)) }

func day(daysAgo int) string {
	return time.Now().AddDate(0, 0, -daysAgo).Format("2006-01-02")
}

func TestListsLastMonthNewestFirstBy20(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)
	clean(t, pool)

	add(t, pool, 90, "Ana", "create", "users", "Muy antigua") // fuera del último mes

	for i := 1; i <= 24; i++ {
		add(t, pool, 1, "Ana", "create", "users", fmt.Sprintf("Persona %02d", i))
	}

	_, first := send(router, "GET", "/api/audit/history", token, nil)
	if count(first) != 20 {
		t.Fatalf("la primera página debe tener 20, tiene %d", count(first))
	}

	cursor := first["meta"].(map[string]any)["next_cursor"].(string)

	_, second := send(router, "GET", "/api/audit/history?cursor="+cursor, token, nil)
	if count(second) != 4 {
		t.Fatalf("sin la línea de hace 90 días quedan 4 en la segunda página: %d", count(second))
	}

	// Lo más reciente primero: la última insertada abre la lista.
	if label := first["data"].([]any)[0].(map[string]any)["label"]; label != "Persona 24" {
		t.Fatalf("lo más reciente primero: %v", label)
	}

	_, old := send(router, "GET", fmt.Sprintf("/api/audit/history?from=%s&to=%s", day(100), day(80)), token, nil)
	if count(old) != 1 {
		t.Fatalf("con un rango propio aparece la línea antigua: %d", count(old))
	}
}

func TestFilters(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)
	clean(t, pool)

	add(t, pool, 1, "Ana", "create", "users", "Carlos Pérez")
	add(t, pool, 1, "Ana", "delete", "users", "Lucía")
	add(t, pool, 1, "Beto", "update", "branches", "Sucursal Centro")
	add(t, pool, 2, "Beto", "update", "catalog/products", "Café molido")

	for path, want := range map[string]int{
		"?entity=users":               2,
		"?action=update":              2,
		"?entity=users&action=delete": 1,
		"?search=cafe":                1, // sin acentos
		"?search=ana":                 2, // también busca por quien lo hizo
		"?direction=asc":              4,
	} {
		if _, got := send(router, "GET", "/api/audit/history"+path, token, nil); count(got) != want {
			t.Errorf("%s: esperaba %d, llegó %d", path, want, count(got))
		}
	}

	_, ascending := send(router, "GET", "/api/audit/history?direction=asc", token, nil)
	if label := ascending["data"].([]any)[0].(map[string]any)["label"]; label != "Café molido" {
		t.Fatalf("del más antiguo al más reciente: %v", label)
	}
}

func TestRangeIsValidated(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	for name, query := range map[string]string{
		"fin antes del inicio": fmt.Sprintf("?from=%s&to=%s", day(1), day(5)),
		"más de un año":        fmt.Sprintf("?from=%s&to=%s", day(500), day(0)),
		"fecha mal escrita":    "?from=ayer",
		"campo inexistente":    "?fields=nope",
		"cursor inválido":      "?cursor=zzz",
	} {
		if code, _ := send(router, "GET", "/api/audit/history"+query, token, nil); code != http.StatusUnprocessableEntity {
			t.Errorf("%s: esperaba 422, llegó %d", name, code)
		}
	}
}

func TestUsersFieldsAndPermissions(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool) // deja su propio login en el historial

	_, users := send(router, "GET", "/api/audit/history/users", admin, nil)
	if count(users) != 1 {
		t.Fatalf("solo aparecen quienes hicieron algo: %v", users)
	}

	_, list := send(router, "GET", "/api/audit/history?fields=action,label", admin, nil)
	for _, item := range list["data"].([]any) {
		keys := make([]string, 0)
		for key := range item.(map[string]any) {
			keys = append(keys, key)
		}

		sort.Strings(keys)

		if got := strings.Join(keys, ","); got != "action,id,label" {
			t.Fatalf("acción, nombre e id: %s", got)
		}
	}

	testutil.NewUser(t, pool, "sin-permiso@minimarket.test")

	outsider := testutil.LoginAs(t, router, "sin-permiso@minimarket.test")
	if code, _ := send(router, "GET", "/api/audit/history", outsider, nil); code != http.StatusForbidden {
		t.Fatalf("sin permiso esperaba 403, llegó %d", code)
	}

	userID := testutil.NewUser(t, pool, "auditor@minimarket.test")
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO user_permissions (user_id, permission, effect) VALUES ($1, 'config.audit.history.view', 'allow')`, userID); err != nil {
		t.Fatal(err)
	}

	auditor := testutil.LoginAs(t, router, "auditor@minimarket.test")
	if code, _ := send(router, "GET", "/api/audit/history", auditor, nil); code != http.StatusOK {
		t.Fatalf("con 'ver' puede leer: %d", code)
	}
}
