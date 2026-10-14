-- "Historial de reparaciones" de las cuentas de Google (las de invitado viven en el navegador y no se guardan aquí).
-- types_json: ids de lo que se hizo (MaintenanceItem o RepairCategory). price_cents: precio en céntimos de euro.
CREATE TABLE repair (
    id           UUID PRIMARY KEY,
    user_id      UUID          NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    vehicle_id   UUID          NOT NULL REFERENCES vehicle (id) ON DELETE CASCADE,
    repair_date  DATE          NOT NULL,
    km           INTEGER       NOT NULL,
    types_json   TEXT          NOT NULL,
    price_cents  INTEGER,
    workshop     VARCHAR(80),
    notes        VARCHAR(1000),
    created_at   TIMESTAMPTZ   NOT NULL
);
CREATE INDEX idx_repair_user ON repair (user_id, repair_date DESC, created_at DESC);
CREATE INDEX idx_repair_vehicle ON repair (vehicle_id);
