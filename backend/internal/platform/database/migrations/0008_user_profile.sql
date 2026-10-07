-- Datos del usuario: código automático (USR-0001, USR-0002…), documento de
-- identidad, teléfono, cargo y último ingreso.

CREATE SEQUENCE user_code_seq;

CREATE FUNCTION next_user_code() RETURNS text
LANGUAGE sql AS $$
    SELECT 'USR-' || CASE WHEN n < 10000 THEN lpad(n::text, 4, '0') ELSE n::text END
    FROM (SELECT nextval('user_code_seq') AS n) AS next
$$;

ALTER TABLE users
    ADD COLUMN code            TEXT,
    ADD COLUMN document_type   TEXT CHECK (document_type IN ('dni', 'ce', 'passport')),
    ADD COLUMN document_number TEXT,
    ADD COLUMN phone           TEXT,
    ADD COLUMN position        TEXT,
    ADD COLUMN last_login_at   TIMESTAMPTZ,
    ADD CONSTRAINT users_document_pair CHECK ((document_type IS NULL) = (document_number IS NULL));

-- Los usuarios que ya existían reciben su código en el orden en que se crearon.
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT id FROM users ORDER BY id LOOP
        UPDATE users SET code = next_user_code() WHERE id = r.id;
    END LOOP;
END $$;

ALTER TABLE users
    ALTER COLUMN code SET DEFAULT next_user_code(),
    ALTER COLUMN code SET NOT NULL;

-- La secuencia pertenece a la columna: vaciar la tabla (pruebas) la reinicia.
ALTER SEQUENCE user_code_seq OWNED BY users.code;

-- El código nunca se reutiliza, ni siquiera el de un usuario eliminado.
CREATE UNIQUE INDEX users_code_unique ON users (code);

-- Un documento pertenece a un solo usuario (entre los que no se eliminaron).
CREATE UNIQUE INDEX users_document_unique ON users (document_type, document_number)
    WHERE deleted_at IS NULL AND document_number IS NOT NULL;

CREATE INDEX users_code_idx ON users (code, id) WHERE deleted_at IS NULL;
