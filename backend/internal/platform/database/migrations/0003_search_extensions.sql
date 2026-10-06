-- Búsqueda de texto con índice: pg_trgm acelera los LIKE '%texto%' y unaccent
-- hace que "cafe" encuentre "Café".
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() no es IMMUTABLE y por eso no se puede indexar; esta envoltura sí.
CREATE FUNCTION f_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent', $1) $$;
