package web_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"minimarket/backend/internal/web"
)

type sample struct {
	ID    int64    `json:"id"`
	Name  string   `json:"name"`
	Email string   `json:"email"`
	Tags  []string `json:"tags"`
	Skip  string   `json:"-"`
}

func run(t *testing.T, query string) (int, map[string]any) {
	t.Helper()

	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(web.Errors())
	router.GET("/x", func(c *gin.Context) {
		fields, ok := web.BindFields[sample](c)
		if !ok {
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": web.Pick(sample{ID: 7, Name: "Ana", Email: "a@x.pe", Tags: []string{"a"}}, fields)})
	})

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest("GET", "/x"+query, nil))

	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)

	return rec.Code, body
}

func TestWithoutFieldsEverythingIsReturned(t *testing.T) {
	code, body := run(t, "")
	data := body["data"].(map[string]any)

	if code != http.StatusOK || len(data) != 4 { // el campo con json:"-" no sale
		t.Fatalf("esperaba los 4 campos: %d %v", code, data)
	}
}

func TestOnlyTheRequestedFieldsAndIDAreReturned(t *testing.T) {
	code, body := run(t, "?fields=name,tags")
	data := body["data"].(map[string]any)

	if code != http.StatusOK || len(data) != 3 || data["id"] != float64(7) || data["name"] != "Ana" || data["tags"] == nil {
		t.Fatalf("esperaba id, name y tags: %d %v", code, data)
	}

	if _, leaked := data["email"]; leaked {
		t.Fatal("email no se pidió y no debe salir")
	}
}

func TestAnUnknownFieldIsRejectedListingTheValidOnes(t *testing.T) {
	code, body := run(t, "?fields=name,password")
	if code != http.StatusUnprocessableEntity {
		t.Fatalf("esperaba 422, llegó %d", code)
	}

	message := body["errors"].(map[string]any)["fields"].([]any)[0].(string)
	for _, want := range []string{"password", "email", "name", "tags", "id"} {
		if !strings.Contains(message, want) {
			t.Errorf("el mensaje debía mencionar %q: %s", want, message)
		}
	}
}

func TestWantsIsTrueForEverythingWhenNothingWasAsked(t *testing.T) {
	var none web.Fields

	if !none.Wants("roles") {
		t.Fatal("sin ?fields se pide todo")
	}

	asked := web.Fields{"name": true}
	if asked.Wants("roles") || !asked.Wants("name") || !asked.Wants("roles", "name") {
		t.Fatal("Wants debe decir solo lo pedido")
	}
}
