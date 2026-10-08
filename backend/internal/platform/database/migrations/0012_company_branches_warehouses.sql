-- Empresa y sucursales: la empresa (RUC), sus sucursales con el código de
-- establecimiento de SUNAT, y los almacenes de cada sucursal.
--
-- Hay UNA empresa hoy, pero la tabla permite varias: cada sucursal apunta a la
-- suya, así no hará falta rehacer nada el día que haya una segunda razón social.

CREATE TABLE companies (
    id             BIGSERIAL PRIMARY KEY,
    ruc            TEXT,
    legal_name     TEXT        NOT NULL,
    trade_name     TEXT        NOT NULL DEFAULT '',
    fiscal_address TEXT        NOT NULL DEFAULT '',
    phone          TEXT        NOT NULL DEFAULT '',
    email          TEXT        NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX companies_ruc_unique ON companies (ruc) WHERE ruc IS NOT NULL;

-- La empresa arranca con un nombre provisional; se completa en Datos de la empresa.
INSERT INTO companies (legal_name) VALUES ('Mi empresa');

ALTER TABLE branches
    ADD COLUMN company_id BIGINT REFERENCES companies (id),
    -- Código de establecimiento anexo de SUNAT (0000 = domicilio fiscal).
    ADD COLUMN sunat_code TEXT CHECK (sunat_code ~ '^[0-9]{4}$'),
    ADD COLUMN phone      TEXT NOT NULL DEFAULT '',
    ADD COLUMN deleted_at TIMESTAMPTZ;

UPDATE branches SET company_id = (SELECT id FROM companies ORDER BY id LIMIT 1);

ALTER TABLE branches ALTER COLUMN company_id SET NOT NULL;

-- El código es único entre las sucursales que no se eliminaron.
DROP INDEX branches_code_unique;
CREATE UNIQUE INDEX branches_code_unique ON branches (lower(code)) WHERE deleted_at IS NULL;

-- Un establecimiento de SUNAT pertenece a una sola sucursal de la empresa.
CREATE UNIQUE INDEX branches_sunat_unique ON branches (company_id, sunat_code)
    WHERE sunat_code IS NOT NULL AND deleted_at IS NULL;

-- Un índice por cada orden permitido en el listado: (columna, id).
CREATE INDEX branches_code_idx    ON branches (code, id)       WHERE deleted_at IS NULL;
CREATE INDEX branches_name_idx    ON branches (name, id)       WHERE deleted_at IS NULL;
CREATE INDEX branches_kind_idx    ON branches (kind, id)       WHERE deleted_at IS NULL;
CREATE INDEX branches_active_idx  ON branches (active, id)     WHERE deleted_at IS NULL;
CREATE INDEX branches_created_idx ON branches (created_at, id) WHERE deleted_at IS NULL;

-- Búsqueda por nombre sin distinguir mayúsculas ni acentos.
CREATE INDEX branches_name_search_idx ON branches
    USING gin (f_unaccent(lower(name)) gin_trgm_ops) WHERE deleted_at IS NULL;

CREATE TABLE warehouses (
    id         BIGSERIAL PRIMARY KEY,
    branch_id  BIGINT      NOT NULL REFERENCES branches (id),
    code       TEXT        NOT NULL,
    name       TEXT        NOT NULL,
    address    TEXT        NOT NULL DEFAULT '',
    active     BOOLEAN     NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El código es único dentro de la sucursal (entre los almacenes que no se eliminaron).
CREATE UNIQUE INDEX warehouses_code_unique ON warehouses (branch_id, lower(code)) WHERE deleted_at IS NULL;

CREATE INDEX warehouses_branch_idx  ON warehouses (branch_id) WHERE deleted_at IS NULL;
CREATE INDEX warehouses_code_idx    ON warehouses (code, id)       WHERE deleted_at IS NULL;
CREATE INDEX warehouses_name_idx    ON warehouses (name, id)       WHERE deleted_at IS NULL;
CREATE INDEX warehouses_active_idx  ON warehouses (active, id)     WHERE deleted_at IS NULL;
CREATE INDEX warehouses_created_idx ON warehouses (created_at, id) WHERE deleted_at IS NULL;

CREATE INDEX warehouses_name_search_idx ON warehouses
    USING gin (f_unaccent(lower(name)) gin_trgm_ops) WHERE deleted_at IS NULL;
