-- "Informe médico": plan de mantenimiento que sugiere la IA para cada coche (correa o cadena, intervalos de cambio...).
-- La clave combina marca, modelo, año y motorización, así que cada versión se consulta una sola vez.
CREATE TABLE maintenance_cache (
    cache_key   VARCHAR(400) PRIMARY KEY,
    plan_json   TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL
);
