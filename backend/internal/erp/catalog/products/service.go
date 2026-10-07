package products

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"minimarket/backend/internal/pagination"
)

// priceFormat: hasta 12 enteros y 2 decimales, como NUMERIC(14,2).
var priceFormat = regexp.MustCompile(`^\d{1,12}(\.\d{1,2})?$`)

// Service concentra las reglas del catálogo. No conoce HTTP.
type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

// normalize limpia la entrada y aplica las reglas que no expresa el JSON.
func normalize(in ProductInput) (ProductInput, error) {
	in.SKU = strings.TrimSpace(in.SKU)
	in.Name = strings.TrimSpace(in.Name)
	in.Price = strings.TrimSpace(in.Price)

	if in.Status == "" {
		in.Status = StatusActive
	}

	switch {
	case in.SKU == "":
		return in, invalidField("sku", "Escribe el SKU.")
	case in.Name == "":
		return in, invalidField("name", "Escribe el nombre.")
	case !priceFormat.MatchString(in.Price):
		return in, invalidField("price", "El precio no es válido (ejemplo: 24.90).")
	case !in.Status.Valid():
		return in, invalidField("status", "El estado no es válido.")
	}

	return in, nil
}

// mapStoreError traduce los errores del store a errores de negocio.
func mapStoreError(err error) error {
	switch {
	case errors.Is(err, errDuplicateSKU):
		return skuTaken()
	case errors.Is(err, errUnknownCategory):
		return invalidField("category_id", "La categoría no existe.")
	case errors.Is(err, errUnknownUnit):
		return invalidField("unit_id", "La unidad no existe.")
	case errors.Is(err, errNotFound):
		return productNotFound()
	default:
		return err
	}
}

func (s *Service) Create(ctx context.Context, in ProductInput) (Product, error) {
	in, err := normalize(in)
	if err != nil {
		return Product{}, err
	}

	id, err := s.store.InsertProduct(ctx, in)
	if err != nil {
		return Product{}, mapStoreError(err)
	}

	product, err := s.store.GetProduct(ctx, id)

	return product, mapStoreError(err)
}

func (s *Service) Update(ctx context.Context, id int64, in ProductInput) (Product, error) {
	in, err := normalize(in)
	if err != nil {
		return Product{}, err
	}

	if err := s.store.UpdateProduct(ctx, id, in); err != nil {
		return Product{}, mapStoreError(err)
	}

	product, err := s.store.GetProduct(ctx, id)

	return product, mapStoreError(err)
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	return mapStoreError(s.store.SoftDeleteProduct(ctx, id))
}

func (s *Service) Get(ctx context.Context, id int64) (Product, error) {
	product, err := s.store.GetProduct(ctx, id)

	return product, mapStoreError(err)
}

func (s *Service) List(ctx context.Context, f ProductFilter) (pagination.Page[Product], error) {
	if f.PriceFrom != "" && !priceFormat.MatchString(f.PriceFrom) {
		return pagination.Page[Product]{}, invalidField("price_from", "El precio no es válido.")
	}

	if f.PriceTo != "" && !priceFormat.MatchString(f.PriceTo) {
		return pagination.Page[Product]{}, invalidField("price_to", "El precio no es válido.")
	}

	return s.store.ListProducts(ctx, f)
}

func (s *Service) Categories(ctx context.Context) ([]Category, error) {
	return s.store.Categories(ctx)
}

func (s *Service) Summary(ctx context.Context) (Summary, error) {
	return s.store.Summary(ctx)
}
