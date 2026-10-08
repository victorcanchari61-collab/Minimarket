package audit_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"minimarket/backend/internal/audit"
	"minimarket/backend/internal/testutil"
)

func TestDescribeReadsTheRoute(t *testing.T) {
	for _, c := range []struct{ method, pattern, entity, action string }{
		{"POST", "/api/users", "users", "create"},
		{"PUT", "/api/users/:id", "users", "update"},
		{"DELETE", "/api/users/:id", "users", "delete"},
		{"PUT", "/api/users/:id/password", "users", "reset_password"},
		{"POST", "/api/access/requests", "access/requests", "create"},
		{"POST", "/api/access/requests/:id/approve", "access/requests", "approve"},
		{"POST", "/api/access/requests/:id/reject", "access/requests", "reject"},
		{"PUT", "/api/access/roles/:id", "access/roles", "update"},
		{"PUT", "/api/company", "company", "update"},
		{"POST", "/api/catalog/products", "catalog/products", "create"},
		{"POST", "/api/logout", "session", "logout"},
		{"PUT", "/api/roles/:id/permissions", "roles/permissions", "update"},
	} {
		entity, action := audit.Describe(c.method, c.pattern)
		if entity != c.entity || action != c.action {
			t.Errorf("%s %s: esperaba %s/%s, llegó %s/%s", c.method, c.pattern, c.entity, c.action, entity, action)
		}
	}
}

type row struct {
	Action, Entity, Label, Email, UserEmail, Method string
	EntityID                                        *int64
	Status                                          int
}

func rows(t *testing.T, pool *pgxpool.Pool) []row {
	t.Helper()

	found, err := pool.Query(context.Background(), `
		SELECT action, entity, label, user_email, method, entity_id, status FROM audit_log ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	defer found.Close()

	var out []row

	for found.Next() {
		var r row
		if err := found.Scan(&r.Action, &r.Entity, &r.Label, &r.UserEmail, &r.Method, &r.EntityID, &r.Status); err != nil {
			t.Fatal(err)
		}

		out = append(out, r)
	}

	return out
}

func send(router *gin.Engine, method, path, token string, body any) (int, map[string]any) {
	rec := testutil.Call(router, method, path, token, body)

	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)

	return rec.Code, out
}

func TestRecordsSuccessfulChangesOnly(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	// Entró: queda anotado el login. Lo borramos para mirar solo los cambios.
	if _, err := pool.Exec(context.Background(), `DELETE FROM audit_log`); err != nil {
		t.Fatal(err)
	}

	send(router, "GET", "/api/branches", token, nil) // leer no se anota

	code, created := send(router, "POST", "/api/branches", token, map[string]any{
		"code": "C01", "name": "Sucursal Centro", "kind": "store",
	})
	if code != http.StatusCreated {
		t.Fatalf("crear sucursal: %d %v", code, created)
	}

	id := int64(created["data"].(map[string]any)["id"].(float64))

	send(router, "POST", "/api/branches", token, map[string]any{"code": ""}) // falla: no se anota
	send(router, "PUT", fmt.Sprintf("/api/branches/%d", id), token, map[string]any{
		"code": "C01", "name": "Sucursal Centro Nueva", "kind": "store",
	})
	send(router, "DELETE", fmt.Sprintf("/api/branches/%d", id), token, nil)

	got := rows(t, pool)
	if len(got) != 3 {
		t.Fatalf("debían quedar 3 líneas (crear, editar, eliminar): %+v", got)
	}

	want := []struct{ action, label string }{
		{"create", "Sucursal Centro"}, {"update", "Sucursal Centro Nueva"}, {"delete", ""},
	}

	for i, w := range want {
		if got[i].Action != w.action || got[i].Entity != "branches" || got[i].Label != w.label ||
			got[i].EntityID == nil || *got[i].EntityID != id || got[i].UserEmail == "" {
			t.Errorf("línea %d inesperada: %+v", i, got[i])
		}
	}
}

func TestRecordsLoginAndFailedLoginWithoutPasswords(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	testutil.Login(t, router, pool)

	if code, _ := send(router, "POST", "/api/login", "", map[string]any{
		"email": "alguien@minimarket.test", "password": "clave-incorrecta-123",
	}); code != http.StatusUnauthorized && code != http.StatusUnprocessableEntity {
		t.Fatalf("login incorrecto esperaba 401/422, llegó %d", code)
	}

	got := rows(t, pool)
	if len(got) < 2 || got[0].Action != "login" || got[len(got)-1].Action != "login_failed" ||
		got[len(got)-1].UserEmail != "alguien@minimarket.test" {
		t.Fatalf("esperaba login y login_failed: %+v", got)
	}

	var leaked int

	if err := pool.QueryRow(context.Background(),
		`SELECT count(*) FROM audit_log WHERE label ILIKE '%clave-incorrecta%' OR path ILIKE '%clave%' OR user_email ILIKE '%clave%'`).
		Scan(&leaked); err != nil || leaked != 0 {
		t.Fatalf("la contraseña no se guarda: %d %v", leaked, err)
	}
}
