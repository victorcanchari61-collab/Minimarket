package pagination_test

import (
	"testing"

	"minimarket/backend/internal/pagination"
)

type row struct{ ID int }

func rows(n int) []row {
	out := make([]row, n)
	for i := range out {
		out[i] = row{ID: i + 1}
	}

	return out
}

func cursorOf(last row) any { return map[string]int{"id": last.ID} }

func TestBuildTrimsToTwentyAndGivesNextCursor(t *testing.T) {
	page, err := pagination.Build(rows(pagination.Limit()), cursorOf)
	if err != nil {
		t.Fatal(err)
	}

	if len(page.Data) != 20 {
		t.Fatalf("esperaba 20 filas, llegaron %d", len(page.Data))
	}

	if page.Meta.NextCursor == nil {
		t.Fatal("con 21 filas debe haber siguiente página")
	}

	var decoded map[string]int
	if ok, err := pagination.Decode(*page.Meta.NextCursor, &decoded); !ok || err != nil {
		t.Fatalf("cursor ilegible: %v", err)
	}

	if decoded["id"] != 20 {
		t.Fatalf("el cursor debe apuntar a la fila 20, apunta a %d", decoded["id"])
	}
}

func TestBuildLastPageHasNoCursor(t *testing.T) {
	page, err := pagination.Build(rows(5), cursorOf)
	if err != nil {
		t.Fatal(err)
	}

	if len(page.Data) != 5 || page.Meta.NextCursor != nil {
		t.Fatalf("última página mal armada: %+v", page.Meta)
	}
}

func TestBuildEmptyIsEmptyArrayNotNull(t *testing.T) {
	page, err := pagination.Build([]row(nil), cursorOf)
	if err != nil {
		t.Fatal(err)
	}

	if page.Data == nil {
		t.Fatal("una página vacía debe serializarse como [] y no como null")
	}
}

func TestDecodeEmptyCursorMeansFirstPage(t *testing.T) {
	var target map[string]int

	ok, err := pagination.Decode("", &target)
	if ok || err != nil {
		t.Fatalf("sin cursor no debe fallar ni decodificar (ok=%v err=%v)", ok, err)
	}
}

func TestDecodeRejectsGarbage(t *testing.T) {
	var target map[string]int

	if _, err := pagination.Decode("esto-no-es-un-cursor", &target); err == nil {
		t.Fatal("un cursor inventado debe rechazarse")
	}
}
