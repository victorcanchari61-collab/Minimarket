-- Administración de usuarios: desactivar (no puede entrar, pero conserva su
-- historial) y eliminar (desaparece de los listados y libera su correo).
ALTER TABLE users
    ADD COLUMN active     BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN deleted_at TIMESTAMPTZ;

-- El correo es único entre los usuarios que no se eliminaron.
DROP INDEX users_email_unique;
CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE deleted_at IS NULL;

-- Un índice por cada orden permitido en el listado: (columna, id).
CREATE INDEX users_name_idx    ON users (name, id)       WHERE deleted_at IS NULL;
CREATE INDEX users_email_idx   ON users (email, id)      WHERE deleted_at IS NULL;
CREATE INDEX users_active_idx  ON users (active, id)     WHERE deleted_at IS NULL;
CREATE INDEX users_created_idx ON users (created_at, id) WHERE deleted_at IS NULL;

-- Búsqueda por nombre sin distinguir mayúsculas ni acentos.
CREATE INDEX users_name_search_idx ON users
    USING gin (f_unaccent(lower(name)) gin_trgm_ops) WHERE deleted_at IS NULL;
