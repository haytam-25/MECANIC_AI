-- BMW, Volkswagen y Audi ahora piden a la IA todas las versiones y su código de motor (ej.: 330d · M57).
-- Se borran sus listas antiguas (sin códigos) para que se vuelvan a consultar.
DELETE FROM engine_cache WHERE brand_id IN ('bmw', 'volkswagen', 'audi');
