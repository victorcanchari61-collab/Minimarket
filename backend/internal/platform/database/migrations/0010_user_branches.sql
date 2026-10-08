-- Sucursales de cada usuario: a cuáles puede entrar. `all_branches` es para
-- quien trabaja en toda la cadena (administradores, gerencia general,
-- contabilidad central): ve todas, también las que se creen después.
ALTER TABLE users ADD COLUMN all_branches BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE user_branches (
    user_id   BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, branch_id)
);

CREATE INDEX user_branches_branch_idx ON user_branches (branch_id);

-- Los administradores que ya existían ven todas las sucursales.
UPDATE users SET all_branches = TRUE
WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code = 'admin');
