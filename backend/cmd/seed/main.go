// Comando de datos de ejemplo: crea categorías y 160 productos para poder ver
// las pantallas con contenido. Solo corre con APP_ENV=local y no hace nada si
// ya hay productos.
//
//	go run ./cmd/seed
package main

import (
	"context"
	"fmt"
	"log"

	"minimarket/backend/internal/auth"
	"minimarket/backend/internal/erp/catalog/products"
	"minimarket/backend/internal/permission"
	"minimarket/backend/internal/platform/config"
	"minimarket/backend/internal/platform/database"

	"github.com/jackc/pgx/v5/pgxpool"
)

// categoría → productos base y su unidad.
var catalogSeed = []struct {
	category string
	products [][2]string
}{
	{"Abarrotes", [][2]string{
		{"Arroz extra 5 kg", "Saco"}, {"Azúcar rubia 1 kg", "Bolsa"}, {"Aceite vegetal 1 L", "Botella"},
		{"Fideo spaghetti 500 g", "Bolsa"}, {"Lenteja bebé 500 g", "Bolsa"}, {"Sal de mesa 1 kg", "Bolsa"},
		{"Atún en aceite 170 g", "Lata"},
	}},
	{"Bebidas", [][2]string{
		{"Gaseosa cola 2.5 L", "Botella"}, {"Agua sin gas 625 ml", "Botella"}, {"Jugo de naranja 1 L", "Caja"},
		{"Cerveza rubia 355 ml", "Lata"}, {"Té helado 500 ml", "Botella"},
	}},
	{"Lácteos", [][2]string{
		{"Leche evaporada 400 g", "Lata"}, {"Yogur natural 1 L", "Botella"}, {"Queso fresco 250 g", "Unidad"},
		{"Mantequilla 200 g", "Barra"},
	}},
	{"Limpieza", [][2]string{
		{"Detergente 900 g", "Bolsa"}, {"Lejía 1 L", "Botella"}, {"Papel higiénico x4", "Paquete"},
		{"Jabón de tocador", "Unidad"},
	}},
	{"Snacks", [][2]string{
		{"Papas fritas 150 g", "Bolsa"}, {"Galletas de soda", "Paquete"}, {"Chocolate en barra", "Unidad"},
		{"Maní salado 100 g", "Bolsa"},
	}},
	{"Panadería", [][2]string{
		{"Pan de molde blanco", "Bolsa"}, {"Pan integral", "Bolsa"}, {"Bizcocho vainilla", "Unidad"},
	}},
}

const totalProducts = 160

func main() {
	cfg := config.Load()
	if !cfg.IsLocal() {
		log.Fatal("los datos de ejemplo solo se cargan con APP_ENV=local")
	}

	ctx := context.Background()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	if err := database.Migrate(ctx, pool); err != nil {
		log.Fatal(err)
	}

	demo, err := auth.NewService(auth.NewStore(pool), 0).EnsureDemoUser(ctx)
	if err != nil {
		log.Fatal(err)
	}

	if err := permission.New(pool).AssignAdmin(ctx, demo.ID); err != nil {
		log.Fatal(err)
	}

	service := products.NewService(products.NewStore(pool))

	existing, err := countProducts(ctx, pool)
	if err != nil {
		log.Fatal(err)
	}

	if existing > 0 {
		fmt.Printf("Ya hay %d productos: no se agrega nada.\n", existing)

		return
	}

	categoryIDs := make([]int64, len(catalogSeed))
	for i, group := range catalogSeed {
		if categoryIDs[i], err = ensureCategory(ctx, pool, group.category); err != nil {
			log.Fatal(err)
		}
	}

	for index := 0; index < totalProducts; index++ {
		id := index + 1
		group := catalogSeed[index%len(catalogSeed)]
		base := group.products[(index/len(catalogSeed))%len(group.products)]
		variant := index/(len(catalogSeed)*3) + 1

		name := base[0]
		if variant > 1 {
			name = fmt.Sprintf("%s · Lote %d", base[0], variant)
		}

		unitRef, err := lookupUnitID(ctx, pool, base[1])
		if err != nil {
			log.Fatal(err)
		}

		categoryID := categoryIDs[index%len(catalogSeed)]
		cents := 200 + (id*53)%4200
		status := products.StatusActive

		if id%11 == 0 {
			status = products.StatusInactive
		}

		if _, err := service.Create(ctx, products.ProductInput{
			SKU:        fmt.Sprintf("SKU-%d", 100000+id*7),
			Name:       name,
			CategoryID: &categoryID,
			UnitID:     unitRef,
			Price:      fmt.Sprintf("%d.%02d", cents/100, cents%100),
			Status:     status,
		}); err != nil {
			log.Fatalf("producto %d: %v", id, err)
		}
	}

	fmt.Printf("Listo: %d productos en %d categorías.\n", totalProducts, len(catalogSeed))
}

// Este comando es infraestructura de desarrollo: consulta directo lo que
// necesita, sin ensuciar el Store del submódulo con métodos que solo él usa.

func countProducts(ctx context.Context, pool *pgxpool.Pool) (n int64, err error) {
	err = pool.QueryRow(ctx, `SELECT count(*) FROM products WHERE deleted_at IS NULL`).Scan(&n)

	return n, err
}

func ensureCategory(ctx context.Context, pool *pgxpool.Pool, name string) (id int64, err error) {
	err = pool.QueryRow(ctx, `
		INSERT INTO product_categories (name) VALUES ($1)
		ON CONFLICT (lower(name)) DO UPDATE SET name = product_categories.name
		RETURNING id`, name).Scan(&id)

	return id, err
}

func lookupUnitID(ctx context.Context, pool *pgxpool.Pool, name string) (id int64, err error) {
	err = pool.QueryRow(ctx, `SELECT id FROM units WHERE lower(name) = lower($1)`, name).Scan(&id)

	return id, err
}
