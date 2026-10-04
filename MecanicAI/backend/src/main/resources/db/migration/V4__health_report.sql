-- "Informe médico" de las cuentas de Google: el último de cada coche del garaje (los de invitado no se guardan).
-- input_json son las respuestas del formulario (km actuales y cuándo se cambió cada elemento); el informe por
-- colores se calcula en el navegador con el plan de mantenimiento de maintenance_cache.
CREATE TABLE health_report (
    vehicle_id  UUID        PRIMARY KEY REFERENCES vehicle (id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    input_json  TEXT        NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_health_report_user ON health_report (user_id, updated_at DESC);
