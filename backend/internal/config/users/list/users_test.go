package list_test

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

	"minimarket/backend/internal/auth"
	"minimarket/backend/internal/testutil"
)

func roleID(t *testing.T, pool *pgxpool.Pool, name string) int64 {
	t.Helper()

	// Las pruebas parten de cero: solo existe Administrador; los demás roles se crean aquí.
	exec(t, pool, `INSERT INTO roles (name) VALUES ($1) ON CONFLICT (lower(name)) DO NOTHING`, name)

	var id int64
	if err := pool.QueryRow(context.Background(), `SELECT id FROM roles WHERE name = $1`, name).Scan(&id); err != nil {
		t.Fatalf("rol %q: %v", name, err)
	}

	return id
}

func create(router *gin.Engine, token string, body map[string]any) (int, map[string]any) {
	rec := testutil.Call(router, "POST", "/api/users", token, body)

	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)

	return rec.Code, out
}

func newUserBody(email string, roles ...int64) map[string]any {
	return map[string]any{
		"name": "Usuario " + email, "email": email, "password": auth.DemoPassword,
		"role_ids": roles, "all_branches": true,
	}
}

func dataID(body map[string]any) int64 {
	return int64(body["data"].(map[string]any)["id"].(float64))
}

func adminID(t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()

	var id int64
	if err := pool.QueryRow(context.Background(), `SELECT id FROM users WHERE email = $1`, auth.DemoEmail).Scan(&id); err != nil {
		t.Fatal(err)
	}

	return id
}

func TestCreateUserWithRolesAndTheyCanLogIn(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)
	cashier := roleID(t, pool, "Cajero")

	code, body := create(router, token, newUserBody("nuevo@minimarket.test", cashier))
	if code != http.StatusCreated {
		t.Fatalf("esperaba 201, llegó %d: %v", code, body)
	}

	user := body["data"].(map[string]any)
	roles := user["roles"].([]any)

	if user["status"] != "active" || len(roles) != 1 || roles[0].(map[string]any)["name"] != "Cajero" {
		t.Fatalf("usuario inesperado: %v", user)
	}

	if _, leaked := user["password_hash"]; leaked {
		t.Fatal("el hash no debe salir en la respuesta")
	}

	testutil.LoginAs(t, router, "nuevo@minimarket.test") // la contraseña guardada es la que se envió
}

func TestCreateRejectsDuplicateEmailWeakPasswordAndUnknownRole(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	if code, _ := create(router, token, newUserBody("repetido@minimarket.test")); code != http.StatusCreated {
		t.Fatalf("la primera debía crearse: %d", code)
	}

	if code, body := create(router, token, newUserBody("REPETIDO@minimarket.test")); code != http.StatusConflict {
		t.Fatalf("correo repetido (sin importar mayúsculas) esperaba 409, llegó %d: %v", code, body)
	}

	weak := newUserBody("debil@minimarket.test")
	weak["password"] = "corta"

	if code, _ := create(router, token, weak); code != http.StatusUnprocessableEntity {
		t.Fatalf("contraseña corta esperaba 422, llegó %d", code)
	}

	if code, _ := create(router, token, newUserBody("fantasma@minimarket.test", 99999)); code != http.StatusUnprocessableEntity {
		t.Fatalf("rol inexistente esperaba 422, llegó %d", code)
	}

	// Nada de lo rechazado quedó a medias (la transacción se revirtió).
	var n int
	_ = pool.QueryRow(context.Background(), `SELECT count(*) FROM users WHERE email = 'fantasma@minimarket.test'`).Scan(&n)

	if n != 0 {
		t.Fatal("el usuario con rol inexistente no debía guardarse")
	}
}

func TestListPaginatesBy20SearchesAndFilters(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	for i := 1; i <= 24; i++ {
		email := fmt.Sprintf("persona%02d@minimarket.test", i)
		if code, body := create(router, token, newUserBody(email)); code != http.StatusCreated {
			t.Fatalf("alta %d: %d %v", i, code, body)
		}
	}

	first := testutil.Decode(t, testutil.Call(router, "GET", "/api/users", token, nil))
	if len(first["data"].([]any)) != 20 {
		t.Fatalf("la primera página debe tener 20, tiene %d", len(first["data"].([]any)))
	}

	cursor := first["meta"].(map[string]any)["next_cursor"].(string)

	second := testutil.Decode(t, testutil.Call(router, "GET", "/api/users?cursor="+cursor, token, nil))
	if got := len(second["data"].([]any)); got != 5 { // 24 + el administrador - 20
		t.Fatalf("la segunda página debe tener 5, tiene %d", got)
	}

	if second["meta"].(map[string]any)["next_cursor"] != nil {
		t.Fatal("no debía haber una tercera página")
	}

	found := testutil.Decode(t, testutil.Call(router, "GET", "/api/users?search=persona07", token, nil))
	if len(found["data"].([]any)) != 1 {
		t.Fatalf("la búsqueda debía dar 1 resultado: %v", found["data"])
	}

	admins := testutil.Decode(t, testutil.Call(router, "GET",
		fmt.Sprintf("/api/users?role_id=%d", roleID(t, pool, "Administrador")), token, nil))
	if len(admins["data"].([]any)) != 1 {
		t.Fatalf("el filtro por rol debía dar solo al administrador: %v", admins["data"])
	}

	if code := testutil.Call(router, "GET", "/api/users?sort=password", token, nil).Code; code != http.StatusUnprocessableEntity {
		t.Fatalf("un orden no permitido esperaba 422, llegó %d", code)
	}
}

func TestUpdateChangesDataRolesAndDeactivationClosesSessions(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	_, created := create(router, token, newUserBody("cambio@minimarket.test", roleID(t, pool, "Cajero")))
	id := dataID(created)
	session := testutil.LoginAs(t, router, "cambio@minimarket.test")

	rec := testutil.Call(router, "PUT", fmt.Sprintf("/api/users/%d", id), token, map[string]any{
		"name": "Nuevo Nombre", "email": "cambio@minimarket.test", "status": "inactive",
		"role_ids": []int64{roleID(t, pool, "Almacenero")}, "all_branches": true,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d: %s", rec.Code, rec.Body.String())
	}

	user := testutil.Decode(t, rec)["data"].(map[string]any)
	if user["name"] != "Nuevo Nombre" || user["status"] != "inactive" ||
		user["roles"].([]any)[0].(map[string]any)["name"] != "Almacenero" {
		t.Fatalf("cambios no aplicados: %v", user)
	}

	if code := testutil.Call(router, "GET", "/api/user", session, nil).Code; code != http.StatusUnauthorized {
		t.Fatalf("la sesión del desactivado debía cerrarse: %d", code)
	}

	login := testutil.Call(router, "POST", "/api/login", "", map[string]string{
		"email": "cambio@minimarket.test", "password": auth.DemoPassword + "x",
	})
	if login.Code != http.StatusUnprocessableEntity {
		t.Fatalf("contraseña mala sigue siendo 422: %d", login.Code)
	}

	login = testutil.Call(router, "POST", "/api/login", "", map[string]string{
		"email": "cambio@minimarket.test", "password": auth.DemoPassword,
	})
	if login.Code != http.StatusForbidden {
		t.Fatalf("un usuario inactivo no entra (403), llegó %d", login.Code)
	}
}

func TestDeleteFreesTheEmailAndHidesTheUser(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	_, created := create(router, token, newUserBody("temporal@minimarket.test"))
	id := dataID(created)

	if code := testutil.Call(router, "DELETE", fmt.Sprintf("/api/users/%d", id), token, nil).Code; code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d", code)
	}

	if code := testutil.Call(router, "GET", fmt.Sprintf("/api/users/%d", id), token, nil).Code; code != http.StatusNotFound {
		t.Fatalf("un usuario eliminado ya no existe: %d", code)
	}

	if code, _ := create(router, token, newUserBody("temporal@minimarket.test")); code != http.StatusCreated {
		t.Fatalf("el correo del eliminado queda libre: %d", code)
	}
}

func TestNobodyCanLockTheSystemOut(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)
	me := adminID(t, pool)
	admin := roleID(t, pool, "Administrador")

	url := fmt.Sprintf("/api/users/%d", me)

	if code := testutil.Call(router, "DELETE", url, token, nil).Code; code != http.StatusConflict {
		t.Fatalf("no puedes eliminarte: %d", code)
	}

	same := map[string]any{
		"name": "Administrador", "email": auth.DemoEmail, "status": "inactive",
		"role_ids": []int64{admin}, "all_branches": true,
	}
	if code := testutil.Call(router, "PUT", url, token, same).Code; code != http.StatusConflict {
		t.Fatalf("no puedes desactivarte: %d", code)
	}

	// Quitarse el rol de administrador siendo el único tampoco.
	same["status"] = "active"
	same["role_ids"] = []int64{roleID(t, pool, "Cajero")}

	if code := testutil.Call(router, "PUT", url, token, same).Code; code != http.StatusConflict {
		t.Fatalf("no puedes quitarte el rol siendo el único administrador: %d", code)
	}

	// Con un segundo administrador activo, sí puede cambiar de rol.
	if code, _ := create(router, token, newUserBody("segundo@minimarket.test", admin)); code != http.StatusCreated {
		t.Fatal("no se pudo crear al segundo administrador")
	}

	if code := testutil.Call(router, "PUT", url, token, same).Code; code != http.StatusOK {
		t.Fatalf("con otro administrador activo debía permitirse: %d", code)
	}
}

func TestCannotRemoveTheLastOtherAdministrator(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	// Un usuario con permiso de eliminar, pero no administrador, no puede
	// eliminar al único administrador.
	_, created := create(router, token, newUserBody("gestor@minimarket.test"))
	exec(t, pool, `INSERT INTO user_permissions (user_id, permission, effect) VALUES ($1, 'config.users', 'allow')`, dataID(created))

	manager := testutil.LoginAs(t, router, "gestor@minimarket.test")

	code := testutil.Call(router, "DELETE", fmt.Sprintf("/api/users/%d", adminID(t, pool)), manager, nil).Code
	if code != http.StatusConflict {
		t.Fatalf("el último administrador no se elimina: %d", code)
	}
}

func exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()

	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}

func TestResetPasswordChangesItAndClosesTheirSessions(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	_, created := create(router, token, newUserBody("clave@minimarket.test"))
	id := dataID(created)
	session := testutil.LoginAs(t, router, "clave@minimarket.test")

	url := fmt.Sprintf("/api/users/%d/password", id)

	if code := testutil.Call(router, "PUT", url, token, map[string]string{"password": "corta"}).Code; code != http.StatusUnprocessableEntity {
		t.Fatalf("contraseña corta esperaba 422, llegó %d", code)
	}

	if code := testutil.Call(router, "PUT", url, token, map[string]string{"password": "otra-clave-1"}).Code; code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d", code)
	}

	if code := testutil.Call(router, "GET", "/api/user", session, nil).Code; code != http.StatusUnauthorized {
		t.Fatalf("la sesión anterior debía cerrarse: %d", code)
	}

	login := testutil.Call(router, "POST", "/api/login", "", map[string]string{
		"email": "clave@minimarket.test", "password": "otra-clave-1",
	})
	if login.Code != http.StatusOK {
		t.Fatalf("la contraseña nueva debe funcionar: %d", login.Code)
	}
}

func TestEveryActionNeedsItsPermission(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	_, created := create(router, admin, newUserBody("viewer@minimarket.test"))
	exec(t, pool, `INSERT INTO user_permissions (user_id, permission, effect) VALUES ($1, 'config.users.list.view', 'allow')`, dataID(created))

	viewer := testutil.LoginAs(t, router, "viewer@minimarket.test")

	if code := testutil.Call(router, "GET", "/api/users", viewer, nil).Code; code != http.StatusOK {
		t.Fatalf("con 'ver' puede listar: %d", code)
	}

	for _, request := range []struct{ method, path string }{
		{"POST", "/api/users"},
		{"PUT", "/api/users/1"},
		{"PUT", "/api/users/1/password"},
		{"DELETE", "/api/users/1"},
	} {
		if code := testutil.Call(router, request.method, request.path, viewer, map[string]any{}).Code; code != http.StatusForbidden {
			t.Errorf("%s %s sin permiso esperaba 403, llegó %d", request.method, request.path, code)
		}
	}
}

func TestCodesAreGeneratedInOrderAndNeverReused(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	codeOfAdmin := testutil.Decode(t, testutil.Call(router, "GET", "/api/users?search=admin", token, nil))["data"].([]any)[0].(map[string]any)["code"]
	if codeOfAdmin != "USR-0001" {
		t.Fatalf("el primer usuario debía ser USR-0001, fue %v", codeOfAdmin)
	}

	_, first := create(router, token, newUserBody("uno@minimarket.test"))
	if got := first["data"].(map[string]any)["code"]; got != "USR-0002" {
		t.Fatalf("esperaba USR-0002, llegó %v", got)
	}

	// El código no se puede enviar ni cambiar: lo ignora.
	body := newUserBody("dos@minimarket.test")
	body["code"] = "USR-9999"

	_, second := create(router, token, body)
	if got := second["data"].(map[string]any)["code"]; got != "USR-0003" {
		t.Fatalf("el código lo genera el sistema, llegó %v", got)
	}

	// Eliminar al último no libera su código.
	testutil.Call(router, "DELETE", fmt.Sprintf("/api/users/%d", dataID(second)), token, nil)

	_, third := create(router, token, newUserBody("tres@minimarket.test"))
	if got := third["data"].(map[string]any)["code"]; got != "USR-0004" {
		t.Fatalf("un código eliminado no se reutiliza, llegó %v", got)
	}

	found := testutil.Decode(t, testutil.Call(router, "GET", "/api/users?search=usr-0002", token, nil))["data"].([]any)
	if len(found) != 1 {
		t.Fatalf("buscar por código debía dar 1 resultado, dio %d", len(found))
	}
}

func TestProfileDataIsValidatedAndDocumentIsUnique(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	body := newUserBody("perfil@minimarket.test")
	body["document_type"] = "dni"
	body["document_number"] = "12345678"
	body["phone"] = "987 654 321"
	body["position"] = "Cajera turno mañana"

	code, created := create(router, token, body)
	if code != http.StatusCreated {
		t.Fatalf("esperaba 201, llegó %d: %v", code, created)
	}

	user := created["data"].(map[string]any)
	if user["document_number"] != "12345678" || user["document_type_label"] != "DNI" ||
		user["phone"] != "987 654 321" || user["position"] != "Cajera turno mañana" {
		t.Fatalf("datos del perfil inesperados: %v", user)
	}

	for name, change := range map[string]map[string]any{
		"dni corto":         {"document_type": "dni", "document_number": "1234"},
		"número sin tipo":   {"document_number": "12345678"},
		"tipo sin número":   {"document_type": "dni"},
		"teléfono inválido": {"phone": "abc"},
		"tipo desconocido":  {"document_type": "licencia", "document_number": "12345678"},
	} {
		next := newUserBody(fmt.Sprintf("x%d@minimarket.test", len(name)))
		for key, value := range change {
			next[key] = value
		}

		if code, _ := create(router, token, next); code != http.StatusUnprocessableEntity {
			t.Errorf("%s: esperaba 422, llegó %d", name, code)
		}
	}

	again := newUserBody("otro@minimarket.test")
	again["document_type"] = "dni"
	again["document_number"] = "12345678"

	if code, _ := create(router, token, again); code != http.StatusConflict {
		t.Fatalf("documento repetido esperaba 409, llegó %d", code)
	}

	// Un usuario sin documento no choca con otro sin documento.
	for _, email := range []string{"sin1@minimarket.test", "sin2@minimarket.test"} {
		if code, _ := create(router, token, newUserBody(email)); code != http.StatusCreated {
			t.Fatalf("sin documento debía crearse: %d", code)
		}
	}
}

func TestLastLoginIsRecorded(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	list := testutil.Decode(t, testutil.Call(router, "GET", "/api/users", token, nil))["data"].([]any)
	if list[0].(map[string]any)["last_login_at"] == nil {
		t.Fatal("el administrador acaba de entrar: debía tener último ingreso")
	}

	_, created := create(router, token, newUserBody("nunca@minimarket.test"))
	if created["data"].(map[string]any)["last_login_at"] != nil {
		t.Fatal("quien nunca entró no tiene último ingreso")
	}
}

func TestSummaryCountsEachIndicator(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	token := testutil.Login(t, router, pool)

	cashier := roleID(t, pool, "Cajero")

	create(router, token, newUserBody("con-rol@minimarket.test", cashier))
	create(router, token, newUserBody("sin-rol@minimarket.test"))

	_, off := create(router, token, newUserBody("apagado@minimarket.test", cashier))
	testutil.Call(router, "PUT", fmt.Sprintf("/api/users/%d", dataID(off)), token, map[string]any{
		"name": "Apagado", "email": "apagado@minimarket.test", "status": "inactive", "role_ids": []int64{cashier},
		"all_branches": true,
	})

	_, gone := create(router, token, newUserBody("borrado@minimarket.test"))
	testutil.Call(router, "DELETE", fmt.Sprintf("/api/users/%d", dataID(gone)), token, nil)

	summary := testutil.Decode(t, testutil.Call(router, "GET", "/api/users/summary", token, nil))["data"].(map[string]any)

	want := map[string]float64{
		"active":         3, // administrador, con-rol y sin-rol (el borrado no cuenta)
		"inactive":       1,
		"administrators": 1,
		"without_roles":  1, // solo sin-rol
	}

	for key, value := range want {
		if summary[key] != value {
			t.Errorf("%s: esperaba %v, llegó %v", key, value, summary[key])
		}
	}
}

func addBranch(t *testing.T, pool *pgxpool.Pool, code, name string) int64 {
	t.Helper()

	var id int64

	err := pool.QueryRow(context.Background(),
		`INSERT INTO branches (company_id, code, name) VALUES ((SELECT id FROM companies LIMIT 1), $1, $2) RETURNING id`, code, name).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}

	return id
}

func branchNames(t *testing.T, router *gin.Engine, token string) []string {
	t.Helper()

	rec := testutil.Call(router, "GET", "/api/company/branches", token, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("lista de sucursales: %d", rec.Code)
	}

	var names []string

	for _, item := range testutil.Decode(t, rec)["data"].([]any) {
		names = append(names, item.(map[string]any)["name"].(string))
	}

	return names
}

func TestUserOnlySeesTheBranchesAssignedToThem(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	centro := addBranch(t, pool, "C01", "Sucursal Centro")
	norte := addBranch(t, pool, "C02", "Sucursal Norte")
	addBranch(t, pool, "C03", "Sucursal Sur")

	body := newUserBody("vendedor@minimarket.test")
	body["all_branches"] = false
	body["branch_ids"] = []int64{norte}

	code, created := create(router, admin, body)
	if code != http.StatusCreated {
		t.Fatalf("esperaba 201, llegó %d: %v", code, created)
	}

	user := created["data"].(map[string]any)
	if user["all_branches"] != false || len(user["branches"].([]any)) != 1 {
		t.Fatalf("debía tener solo Norte: %v", user)
	}

	seller := testutil.LoginAs(t, router, "vendedor@minimarket.test")

	if got := branchNames(t, router, seller); len(got) != 1 || got[0] != "Sucursal Norte" {
		t.Fatalf("el vendedor solo ve Norte, ve %v", got)
	}

	// El administrador ve todas, también las que se creen después.
	if got := branchNames(t, router, admin); len(got) != 3 {
		t.Fatalf("el administrador ve las 3, ve %v", got)
	}

	// Se le suma Centro.
	url := fmt.Sprintf("/api/users/%d", dataID(created))

	rec := testutil.Call(router, "PUT", url, admin, map[string]any{
		"name": "Vendedor", "email": "vendedor@minimarket.test", "status": "active",
		"all_branches": false, "branch_ids": []int64{norte, centro},
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("esperaba 200, llegó %d: %s", rec.Code, rec.Body.String())
	}

	if got := branchNames(t, router, seller); len(got) != 2 {
		t.Fatalf("ahora ve Centro y Norte, ve %v", got)
	}

	// "Todas": ve incluso una sucursal que se crea después.
	testutil.Call(router, "PUT", url, admin, map[string]any{
		"name": "Vendedor", "email": "vendedor@minimarket.test", "status": "active", "all_branches": true,
	})
	addBranch(t, pool, "C04", "Sucursal Este")

	if got := branchNames(t, router, seller); len(got) != 4 {
		t.Fatalf("con 'todas' ve las 4, ve %v", got)
	}
}

func TestBranchRuleIsEnforced(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	norte := addBranch(t, pool, "C02", "Sucursal Norte")

	none := newUserBody("sin-sucursal@minimarket.test")
	none["all_branches"] = false

	if code, _ := create(router, admin, none); code != http.StatusUnprocessableEntity {
		t.Fatalf("sin sucursal ni 'todas' esperaba 422, llegó %d", code)
	}

	ghost := newUserBody("fantasma@minimarket.test")
	ghost["all_branches"] = false
	ghost["branch_ids"] = []int64{99999}

	if code, _ := create(router, admin, ghost); code != http.StatusUnprocessableEntity {
		t.Fatalf("sucursal inexistente esperaba 422, llegó %d", code)
	}

	// Un administrador siempre trabaja en toda la cadena, aunque se envíe otra cosa.
	boss := newUserBody("jefe@minimarket.test", roleID(t, pool, "Administrador"))
	boss["all_branches"] = false
	boss["branch_ids"] = []int64{norte}

	code, created := create(router, admin, boss)
	if code != http.StatusCreated {
		t.Fatalf("esperaba 201, llegó %d: %v", code, created)
	}

	user := created["data"].(map[string]any)
	if user["all_branches"] != true || len(user["branches"].([]any)) != 0 {
		t.Fatalf("un administrador ve todas: %v", user)
	}
}

func TestBranchesLookupForTheForm(t *testing.T) {
	router, pool := testutil.Router(t, "local")
	admin := testutil.Login(t, router, pool)

	addBranch(t, pool, "C01", "Sucursal Centro")

	rec := testutil.Call(router, "GET", "/api/users/branches", admin, nil)
	if rec.Code != http.StatusOK || len(testutil.Decode(t, rec)["data"].([]any)) != 1 {
		t.Fatalf("la lista del formulario debía traer la sucursal: %d %s", rec.Code, rec.Body.String())
	}

	roles := testutil.Decode(t, testutil.Call(router, "GET", "/api/users/roles", admin, nil))["data"].([]any)
	if roles[0].(map[string]any)["is_admin"] != true {
		t.Fatalf("el rol Administrador debe venir marcado: %v", roles)
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

	create(router, token, newUserBody("campos@minimarket.test", roleID(t, pool, "Cajero")))

	rows := func(query string) []any {
		return testutil.Decode(t, testutil.Call(router, "GET", "/api/users"+query, token, nil))["data"].([]any)
	}

	for _, item := range rows("?fields=name,email") {
		if got := fieldKeys(item); got != "email,id,name" {
			t.Fatalf("solo nombre, correo e id: %s", got)
		}
	}

	var withRoles int

	for _, item := range rows("?fields=name,roles") {
		if got := fieldKeys(item); got != "id,name,roles" {
			t.Fatalf("nombre, roles e id: %s", got)
		}

		if len(item.(map[string]any)["roles"].([]any)) == 1 {
			withRoles++
		}
	}

	if withRoles != 2 { // el administrador y el de la prueba tienen un rol cada uno
		t.Fatalf("pidiendo roles deben venir calculados: %d con rol", withRoles)
	}

	for _, item := range rows("?fields=name,branches") {
		if got := fieldKeys(item); got != "branches,id,name" {
			t.Fatalf("nombre, sucursales e id: %s", got)
		}
	}

	if code := testutil.Call(router, "GET", "/api/users?fields=password", token, nil).Code; code != http.StatusUnprocessableEntity {
		t.Fatalf("un campo que no existe esperaba 422, llegó %d", code)
	}

	if len(rows("")[0].(map[string]any)) < 12 {
		t.Fatal("sin ?fields debe venir la fila completa")
	}
}
