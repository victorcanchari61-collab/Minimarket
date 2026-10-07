-- Control de acceso: roles con permisos, y usuarios que heredan de sus roles
-- y además pueden recibir permisos (o denegaciones) directos.
--
-- Un permiso es un código del árbol sistema.módulo.submódulo.acción
-- ("erp.catalog.products.edit"), o cualquier nivel superior ("erp.catalog",
-- "erp") o "*" para todo. El catálogo de códigos válidos vive en el código
-- (internal/permission), no aquí: agregar un submódulo no requiere migración.

CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    -- Solo los roles del sistema tienen código ('admin'); no se editan ni se borran.
    code        TEXT UNIQUE,
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX roles_name_unique ON roles (lower(name));

CREATE TABLE role_permissions (
    role_id    BIGINT NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission TEXT   NOT NULL,
    PRIMARY KEY (role_id, permission)
);

-- Un rol con usuarios no se puede borrar: primero se reasignan.
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX user_roles_role_idx ON user_roles (role_id);

CREATE TABLE user_permissions (
    user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    permission TEXT   NOT NULL,
    effect     TEXT   NOT NULL CHECK (effect IN ('allow', 'deny')),
    PRIMARY KEY (user_id, permission)
);

-- Roles iniciales. Los editables pueden cambiarse o borrarse desde Configuraciones.
INSERT INTO roles (code, name, description) VALUES
    ('admin', 'Administrador', 'Acceso total, incluido lo que se agregue en el futuro.'),
    (NULL, 'Gerente de tienda', 'Opera la tienda: ventas, inventario, reportes y clientes.'),
    (NULL, 'Cajero', 'Vende y maneja su caja.'),
    (NULL, 'Almacenero', 'Inventario y almacén.'),
    (NULL, 'Contador', 'Finanzas, activos fijos y facturación.'),
    (NULL, 'Recursos Humanos', 'Personal, asistencia y planilla.');

INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p.permission
FROM roles r
JOIN (VALUES
    ('Administrador',     '*'),
    ('Gerente de tienda', 'pos'),
    ('Gerente de tienda', 'erp.inventory'),
    ('Gerente de tienda', 'bi'),
    ('Gerente de tienda', 'crm'),
    ('Cajero',            'pos.sales'),
    ('Cajero',            'pos.cash'),
    ('Cajero',            'pos.billing.documents.view'),
    ('Almacenero',        'erp.inventory'),
    ('Almacenero',        'wms'),
    ('Contador',          'erp.finance'),
    ('Contador',          'erp.fixed_assets'),
    ('Contador',          'pos.billing'),
    ('Recursos Humanos',  'hcm')
) AS p (role_name, permission) ON p.role_name = r.name;

-- Los usuarios que ya existían (quien montó el sistema) quedan como Administrador.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u CROSS JOIN roles r WHERE r.code = 'admin';
