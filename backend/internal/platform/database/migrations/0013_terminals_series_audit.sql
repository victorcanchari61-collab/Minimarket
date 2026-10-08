-- Terminales y series: las cajas de cada tienda y la numeración de sus comprobantes.
-- Auditoría: el registro de quién hizo qué y cuándo.

CREATE TABLE pos_terminals (
    id           BIGSERIAL PRIMARY KEY,
    branch_id    BIGINT      NOT NULL REFERENCES branches (id),
    -- Almacén del que descuenta lo que se vende en esta caja (opcional).
    warehouse_id BIGINT      REFERENCES warehouses (id),
    code         TEXT        NOT NULL,
    name         TEXT        NOT NULL,
    active       BOOLEAN     NOT NULL DEFAULT TRUE,
    deleted_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El código es único dentro de la sucursal (entre las terminales que no se eliminaron).
CREATE UNIQUE INDEX pos_terminals_code_unique ON pos_terminals (branch_id, lower(code)) WHERE deleted_at IS NULL;

CREATE INDEX pos_terminals_branch_idx  ON pos_terminals (branch_id) WHERE deleted_at IS NULL;
CREATE INDEX pos_terminals_code_idx    ON pos_terminals (code, id)       WHERE deleted_at IS NULL;
CREATE INDEX pos_terminals_name_idx    ON pos_terminals (name, id)       WHERE deleted_at IS NULL;
CREATE INDEX pos_terminals_active_idx  ON pos_terminals (active, id)     WHERE deleted_at IS NULL;
CREATE INDEX pos_terminals_created_idx ON pos_terminals (created_at, id) WHERE deleted_at IS NULL;

CREATE INDEX pos_terminals_name_search_idx ON pos_terminals
    USING gin (f_unaccent(lower(name)) gin_trgm_ops) WHERE deleted_at IS NULL;

CREATE TABLE document_series (
    id            BIGSERIAL PRIMARY KEY,
    branch_id     BIGINT      NOT NULL REFERENCES branches (id),
    -- La caja que usa la serie; vacío = la usa la sucursal (por ejemplo, las guías).
    terminal_id   BIGINT      REFERENCES pos_terminals (id),
    document_type TEXT        NOT NULL CHECK (document_type IN
                      ('invoice', 'receipt', 'credit_note', 'debit_note', 'dispatch_guide')),
    -- Cuatro caracteres, como los pide SUNAT: F001, B001, FC01, T001…
    series        TEXT        NOT NULL CHECK (series ~ '^[A-Z0-9]{4}$'),
    -- El siguiente correlativo. Lo mueve el sistema al emitir; nunca retrocede.
    next_number   BIGINT      NOT NULL DEFAULT 1 CHECK (next_number >= 1),
    active        BOOLEAN     NOT NULL DEFAULT TRUE,
    deleted_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una serie no se repite para el mismo tipo de comprobante en toda la empresa.
CREATE UNIQUE INDEX document_series_unique ON document_series (document_type, series) WHERE deleted_at IS NULL;

CREATE INDEX document_series_branch_idx   ON document_series (branch_id)   WHERE deleted_at IS NULL;
CREATE INDEX document_series_terminal_idx ON document_series (terminal_id) WHERE deleted_at IS NULL;
CREATE INDEX document_series_series_idx   ON document_series (series, id)        WHERE deleted_at IS NULL;
CREATE INDEX document_series_type_idx     ON document_series (document_type, id) WHERE deleted_at IS NULL;
CREATE INDEX document_series_active_idx   ON document_series (active, id)        WHERE deleted_at IS NULL;
CREATE INDEX document_series_created_idx  ON document_series (created_at, id)    WHERE deleted_at IS NULL;

CREATE TABLE audit_log (
    id         BIGSERIAL PRIMARY KEY,
    at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Quién lo hizo. Se guarda también su nombre y correo de ese momento:
    -- el usuario puede renombrarse o eliminarse y el historial no cambia.
    user_id    BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    user_name  TEXT        NOT NULL DEFAULT '',
    user_email TEXT        NOT NULL DEFAULT '',
    action     TEXT        NOT NULL,
    -- Sobre qué: la ruta de la API ("users", "catalog/products") y el registro.
    entity     TEXT        NOT NULL,
    entity_id  BIGINT,
    label      TEXT        NOT NULL DEFAULT '',
    method     TEXT        NOT NULL DEFAULT '',
    path       TEXT        NOT NULL DEFAULT '',
    status     INTEGER     NOT NULL DEFAULT 0,
    ip         TEXT        NOT NULL DEFAULT ''
);

-- El historial se lee de lo más reciente a lo más antiguo, casi siempre dentro
-- de un rango de fechas y, a veces, de una persona o de un tipo de registro.
CREATE INDEX audit_log_at_idx     ON audit_log (at, id);
CREATE INDEX audit_log_user_idx   ON audit_log (user_id, at, id);
CREATE INDEX audit_log_entity_idx ON audit_log (entity, at, id);
CREATE INDEX audit_log_action_idx ON audit_log (action, at, id);
