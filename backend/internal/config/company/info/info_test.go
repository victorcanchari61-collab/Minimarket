package info_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/testutil"
)

func send(router *gin.Engine, method, path, token string, body any) (int, map[string]any) {
	rec := testutil.Call(router, method, path, token, body)

	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)

	return rec.Code, out
}

func TestCompanyStartsWithAPlaceholderAndCanBeCompleted(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	code, body := send(router, "GET", "/api/company", token, nil)
	if code != http.StatusOK || body["data"].(map[string]any)["ruc"] != "" {
		t.Fatalf("la empresa arranca sin RUC: %d %v", code, body)
	}

	code, body = send(router, "PUT", "/api/company", token, map[string]any{
		"ruc": "20100070970", "legal_name": "  Supermercados Del Sur S.A.C. ", "trade_name": "MiniMarket",
		"fiscal_address": "Av. Principal 120, Lima", "phone": "01 234 5678", "email": "contacto@minimarket.pe",
	})
	if code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d: %v", code, body)
	}

	company := body["data"].(map[string]any)
	if company["legal_name"] != "Supermercados Del Sur S.A.C." || company["ruc"] != "20100070970" {
		t.Fatalf("datos inesperados: %v", company)
	}

	_, shown := send(router, "GET", "/api/company", token, nil)
	if shown["data"].(map[string]any)["trade_name"] != "MiniMarket" {
		t.Fatalf("lo guardado debía leerse de vuelta: %v", shown)
	}
}

func TestCompanyRejectsBadData(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	cases := map[string]map[string]any{
		"sin razón social":        {"legal_name": " "},
		"RUC corto":               {"legal_name": "X", "ruc": "2010007"},
		"RUC con dígito mal":      {"legal_name": "X", "ruc": "20100070971"},
		"RUC con letras":          {"legal_name": "X", "ruc": "2010007097A"},
		"RUC de tipo inexistente": {"legal_name": "X", "ruc": "30100070970"},
		"correo inválido":         {"legal_name": "X", "email": "no-es-correo"},
		"teléfono inválido":       {"legal_name": "X", "phone": "abc"},
	}

	for name, body := range cases {
		if code, _ := send(router, "PUT", "/api/company", token, body); code != http.StatusUnprocessableEntity {
			t.Errorf("%s: esperaba 422, llegó %d", name, code)
		}
	}

	// El RUC es opcional hasta que se registre; los válidos se aceptan
	// (persona jurídica 20… y persona natural 10…).
	for _, ruc := range []string{"", "20100070970", "10123456781"} {
		if code, body := send(router, "PUT", "/api/company", token, map[string]any{"legal_name": "X", "ruc": ruc}); code != http.StatusOK {
			t.Errorf("RUC %q esperaba 200, llegó %d: %v", ruc, code, body)
		}
	}
}

func TestCompanyNeedsItsPermissions(t *testing.T) {
	router, pool := testutil.Router(t, "local")

	userID := testutil.NewUser(t, pool, "mira-empresa@minimarket.test")
	if _, err := pool.Exec(t.Context(),
		`INSERT INTO user_permissions (user_id, permission, effect) VALUES ($1, 'config.company.info.view', 'allow')`, userID); err != nil {
		t.Fatal(err)
	}

	viewer := testutil.LoginAs(t, router, "mira-empresa@minimarket.test")

	if code, _ := send(router, "GET", "/api/company", viewer, nil); code != http.StatusOK {
		t.Fatalf("con 'ver' puede mirar: %d", code)
	}

	if code, _ := send(router, "PUT", "/api/company", viewer, map[string]any{"legal_name": "Otra"}); code != http.StatusForbidden {
		t.Fatalf("editar sin permiso esperaba 403, llegó %d", code)
	}
}
