-- Sucursales: los puntos físicos de la cadena. Una sucursal no es una caja ni un
-- sistema: tiene almacenes, terminales y personal (esas tablas llegan después
-- y apuntarán aquí). Un centro de distribución es una sucursal que no vende.
CREATE TABLE branches (
    id         BIGSERIAL PRIMARY KEY,
    code       TEXT        NOT NULL,
    name       TEXT        NOT NULL,
    address    TEXT        NOT NULL DEFAULT '',
    kind       TEXT        NOT NULL DEFAULT 'store' CHECK (kind IN ('store', 'distribution')),
    active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX branches_code_unique ON branches (lower(code));
