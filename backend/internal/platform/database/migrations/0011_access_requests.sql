-- Solicitudes de acceso: alguien abre una pantalla que no puede ver, pide el
-- permiso con su motivo, y quien administra accesos lo aprueba (se le da el
-- permiso directo) o lo rechaza.
CREATE TABLE access_requests (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Una acción concreta del catálogo: "erp.catalog.products.view".
    permission    TEXT        NOT NULL,
    reason        TEXT        NOT NULL DEFAULT '',
    status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by    BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    decided_at    TIMESTAMPTZ,
    decision_note TEXT        NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una persona no puede tener dos solicitudes pendientes por lo mismo.
CREATE UNIQUE INDEX access_requests_pending_unique ON access_requests (user_id, permission)
    WHERE status = 'pending';

-- El listado va de la más reciente a la más antigua, por estado: (estado, fecha, id).
CREATE INDEX access_requests_status_idx ON access_requests (status, created_at, id);
