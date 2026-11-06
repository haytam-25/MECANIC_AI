-- "Documentación" de las cuentas de Google (los invitados no la guardan): las secciones de papeles de cada coche y
-- las fotos o PDF que se suben a cada una.
-- kind: CIRCULATION (permiso de circulación / cédula), INSPECTION (ITV / VTV / RTO), INSURANCE (seguro obligatorio)
-- o CUSTOM (sección con el nombre que elija el usuario, en title). Las tres primeras, una como mucho por coche.
-- expires_on y reminder: solo ITV y seguro. Con el aviso activado se manda un email cada semana durante los dos meses
-- antes de que caduque; last_reminded_on es el día del último (vuelve a null si cambia la fecha).
CREATE TABLE document_section (
    id                UUID PRIMARY KEY,
    user_id           UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    vehicle_id        UUID         NOT NULL REFERENCES vehicle (id) ON DELETE CASCADE,
    kind              VARCHAR(20)  NOT NULL,
    title             VARCHAR(40),
    expires_on        DATE,
    reminder          BOOLEAN      NOT NULL DEFAULT FALSE,
    last_reminded_on  DATE,
    created_at        TIMESTAMPTZ  NOT NULL
);
CREATE UNIQUE INDEX uq_document_section_kind ON document_section (vehicle_id, kind) WHERE kind <> 'CUSTOM';
CREATE INDEX idx_document_section_user ON document_section (user_id, created_at);
CREATE INDEX idx_document_section_reminder ON document_section (expires_on) WHERE reminder;

-- Fotos (JPEG, PNG o WebP) o PDF de cada sección. content_type es el tipo real del archivo (se mira su contenido,
-- no lo que dice el navegador). Como mucho app.limits.max-documents por cuenta entre todos sus coches.
CREATE TABLE document_file (
    id            UUID PRIMARY KEY,
    user_id       UUID          NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    section_id    UUID          NOT NULL REFERENCES document_section (id) ON DELETE CASCADE,
    file_name     VARCHAR(120)  NOT NULL,
    content_type  VARCHAR(40)   NOT NULL,
    size_bytes    INTEGER       NOT NULL,
    content       BYTEA         NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL
);
CREATE INDEX idx_document_file_user ON document_file (user_id);
CREATE INDEX idx_document_file_section ON document_file (section_id, created_at);
