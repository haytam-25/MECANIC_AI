-- "Cesta" de las cuentas de Google: lo que hay que comprar para cada coche (las de invitado viven en el navegador y
-- no se guardan aquí). Al marcar un artículo como comprado se borra.
CREATE TABLE basket_item (
    id          UUID PRIMARY KEY,
    user_id     UUID          NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    vehicle_id  UUID          NOT NULL REFERENCES vehicle (id) ON DELETE CASCADE,
    item_text   VARCHAR(120)  NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL
);
CREATE INDEX idx_basket_item_user ON basket_item (user_id, created_at);
CREATE INDEX idx_basket_item_vehicle ON basket_item (vehicle_id);
