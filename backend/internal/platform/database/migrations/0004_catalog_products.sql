-- ERP › Catálogo y maestros › Productos.
-- Datos maestros compartidos: sin prefijo (products, product_categories, units).

CREATE TABLE units (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    abbreviation TEXT NOT NULL
);

CREATE UNIQUE INDEX units_name_unique ON units (lower(name));

-- Datos de referencia (no son datos de ejemplo): unidades de medida comunes.
INSERT INTO units (name, abbreviation) VALUES
    ('Unidad', 'und'), ('Caja', 'cja'), ('Paquete', 'paq'), ('Bolsa', 'bls'),
    ('Botella', 'bot'), ('Lata', 'lta'), ('Saco', 'sco'), ('Docena', 'doc'),
    ('Barra', 'brr'), ('Kilogramo', 'kg'), ('Litro', 'l');

CREATE TABLE product_categories (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_categories_name_unique ON product_categories (lower(name));

CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    sku         TEXT           NOT NULL,
    name        TEXT           NOT NULL,
    category_id BIGINT         REFERENCES product_categories (id),
    unit_id     BIGINT         NOT NULL REFERENCES units (id),
    price       NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    status      TEXT           NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    deleted_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- El SKU es único entre los productos que no se eliminaron.
CREATE UNIQUE INDEX products_sku_unique ON products (lower(sku)) WHERE deleted_at IS NULL;

-- Un índice por cada orden permitido en el listado: (columna, id) cubre
-- ORDER BY col, id y la condición del cursor (col, id) > (valor, id).
CREATE INDEX products_name_idx   ON products (name, id)   WHERE deleted_at IS NULL;
CREATE INDEX products_sku_idx    ON products (sku, id)    WHERE deleted_at IS NULL;
CREATE INDEX products_price_idx  ON products (price, id)  WHERE deleted_at IS NULL;
CREATE INDEX products_status_idx ON products (status, id) WHERE deleted_at IS NULL;

CREATE INDEX products_category_idx ON products (category_id) WHERE deleted_at IS NULL;

-- Búsqueda por nombre sin distinguir mayúsculas ni acentos.
CREATE INDEX products_name_search_idx ON products
    USING gin (f_unaccent(lower(name)) gin_trgm_ops) WHERE deleted_at IS NULL;
