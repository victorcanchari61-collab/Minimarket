package permission_test

import (
	"slices"
	"strings"
	"testing"

	"minimarket/backend/internal/permission"
)

var catalog = permission.DefaultCatalog()

func check(t *testing.T, g permission.Grants, code string, want bool) {
	t.Helper()

	if got := catalog.Allows(g, code); got != want {
		t.Errorf("Allows(%q) = %v, esperaba %v (con %+v)", code, got, want, g)
	}
}

func TestGrantAtEveryLevelOfTheTree(t *testing.T) {
	const edit = "erp.catalog.products.edit"

	cases := map[string]bool{
		"*":                           true, // todo
		"erp":                         true, // un sistema
		"erp.catalog":                 true, // un módulo
		"erp.catalog.products":        true, // un submódulo
		"erp.catalog.products.edit":   true, // una acción
		"erp.inventory":               false,
		"pos":                         false,
		"erp.catalog.units":           false,
		"erp.catalog.products.create": false,
	}

	for rule, want := range cases {
		check(t, permission.Grants{Allow: []string{rule}}, edit, want)
	}
}

func TestAGrantDoesNotLeakToSiblingsWithTheSamePrefix(t *testing.T) {
	// "erp.catalog.products" no debe cubrir "erp.catalog.products_extra".
	g := permission.Grants{Allow: []string{"erp.catalog.unit"}}

	check(t, g, "erp.catalog.units.view", false)
}

func TestAnyActionImpliesViewingTheSubmodule(t *testing.T) {
	g := permission.Grants{Allow: []string{"erp.catalog.products.edit"}}

	check(t, g, "erp.catalog.products.view", true)
	check(t, g, "erp.catalog.products.edit", true)
	check(t, g, "erp.catalog.products.create", false)
	check(t, g, "erp.catalog.units.view", false)
}

func TestApprovalIsAnActionOfItsOwn(t *testing.T) {
	g := permission.Grants{Allow: []string{"erp.purchasing.purchase_orders.approve"}}

	check(t, g, "erp.purchasing.purchase_orders.approve", true)
	check(t, g, "erp.purchasing.purchase_orders.view", true)
	check(t, g, "erp.purchasing.purchase_orders.create", false)
	check(t, g, "erp.purchasing.purchase_orders.send", false)
}

func TestDenyBeatsAllow(t *testing.T) {
	g := permission.Grants{
		Allow: []string{"erp"},
		Deny:  []string{"erp.catalog.products.delete"},
	}

	check(t, g, "erp.catalog.products.edit", true)
	check(t, g, "erp.catalog.products.delete", false)
}

func TestDenyingViewBlocksTheWholeSubmodule(t *testing.T) {
	g := permission.Grants{
		Allow: []string{"erp"},
		Deny:  []string{"erp.catalog.products.view"},
	}

	check(t, g, "erp.catalog.products.view", false)
	check(t, g, "erp.catalog.products.edit", false) // no se actúa sobre lo que no se ve
	check(t, g, "erp.catalog.units.edit", true)
}

func TestDenyAtModuleOrSystemLevel(t *testing.T) {
	g := permission.Grants{Allow: []string{"*"}, Deny: []string{"erp.finance"}}

	check(t, g, "erp.finance.ledger.view", false)
	check(t, g, "erp.finance.ledger.close", false)
	check(t, g, "erp.catalog.products.view", true)
	check(t, g, "pos.sales.quick_sale.register", true)
}

func TestSuperuserIgnoresDenials(t *testing.T) {
	g := permission.Grants{Superuser: true, Deny: []string{"erp"}}

	check(t, g, "erp.catalog.products.delete", true)
}

func TestNothingIsAllowedWithoutGrants(t *testing.T) {
	check(t, permission.Grants{}, "erp.catalog.products.view", false)
}

func TestOnlyConcreteCatalogActionsCanBeAsked(t *testing.T) {
	g := permission.Grants{Superuser: true}

	check(t, g, "erp.catalog", false)              // un módulo no es una acción
	check(t, g, "erp.catalog.products", false)     // ni un submódulo
	check(t, g, "erp.catalog.products.fly", false) // acción que no existe
	check(t, g, "erp.nada.products.view", false)
}

func TestEffectiveListsExactlyWhatTheUserCanDo(t *testing.T) {
	g := permission.Grants{
		Allow: []string{"erp.catalog.products.edit", "pos.cash"},
		Deny:  []string{"pos.cash.count"},
	}

	got := catalog.Effective(g)

	for _, want := range []string{
		"erp.catalog.products.view", "erp.catalog.products.edit",
		"pos.cash.open_close.open", "pos.cash.open_close.close", "pos.cash.movements.register",
	} {
		if !slices.Contains(got, want) {
			t.Errorf("falta %q en %v", want, got)
		}
	}

	for _, banned := range []string{"erp.catalog.products.delete", "pos.cash.count.view", "pos.cash.count.register"} {
		if slices.Contains(got, banned) {
			t.Errorf("no debería incluir %q", banned)
		}
	}

	if all := catalog.Effective(permission.Grants{Superuser: true}); len(all) != len(catalog.Actions()) {
		t.Errorf("el superusuario debe poder todas las acciones: %d de %d", len(all), len(catalog.Actions()))
	}
}

func TestCatalogIsConsistent(t *testing.T) {
	seen := map[string]bool{}

	for _, action := range catalog.Actions() {
		if seen[action] {
			t.Errorf("acción repetida: %s", action)
		}

		seen[action] = true

		if !permission.IsAction(action) || !catalog.Valid(action) {
			t.Errorf("acción inválida: %s", action)
		}

		if strings.ToLower(action) != action || strings.ContainsAny(action, " -") {
			t.Errorf("código mal formado (minúsculas y guion bajo): %s", action)
		}
	}

	if len(seen) < 300 {
		t.Errorf("el catálogo parece incompleto: %d acciones", len(seen))
	}

	// Todo submódulo se puede ver.
	for _, sys := range catalog.Systems {
		for _, mod := range sys.Modules {
			for _, sub := range mod.Submodules {
				if !seen[sys.Code+"."+mod.Code+"."+sub.Code+".view"] {
					t.Errorf("%s.%s.%s no tiene 'ver'", sys.Code, mod.Code, sub.Code)
				}
			}
		}
	}
}

func TestDuplicateCodesInACatalogAreCaughtAtStartup(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("un catálogo con códigos repetidos debía fallar al armarse")
		}
	}()

	dup := permission.System{Code: "x", Label: "X", Modules: []permission.Module{{
		Code: "m", Label: "M", Submodules: []permission.Submodule{
			{Code: "s", Label: "S", Actions: []permission.Action{permission.Edit, permission.Edit}},
		},
	}}}

	permission.NewCatalog(dup)
}
