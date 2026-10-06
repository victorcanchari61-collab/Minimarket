CREATE TABLE users (
    id                BIGSERIAL PRIMARY KEY,
    name              TEXT        NOT NULL,
    email             TEXT        NOT NULL,
    email_verified_at TIMESTAMPTZ,
    password_hash     TEXT        NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El correo es único sin distinguir mayúsculas.
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
