-- Un token por inicio de sesión. Solo se guarda el hash (SHA-256): si alguien
-- ve la tabla no puede usar los tokens.
CREATE TABLE api_tokens (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    token_hash   CHAR(64)    NOT NULL,
    last_used_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX api_tokens_hash_unique ON api_tokens (token_hash);
CREATE INDEX api_tokens_user_idx ON api_tokens (user_id);
