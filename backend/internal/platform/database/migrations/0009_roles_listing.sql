-- Un índice por cada orden permitido en el listado de roles: (columna, id).
CREATE INDEX roles_name_idx    ON roles (name, id);
CREATE INDEX roles_created_idx ON roles (created_at, id);
