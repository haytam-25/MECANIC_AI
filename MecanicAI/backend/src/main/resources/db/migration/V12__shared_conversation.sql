-- Consultas compartidas con un enlace público de solo lectura (/compartido/<token>).
-- No se copia el contenido: se enseña la conversación hasta el mensaje last_message_id (el último al compartir).
CREATE TABLE shared_conversation (
    token            VARCHAR(32) PRIMARY KEY,
    conversation_id  UUID        NOT NULL UNIQUE REFERENCES conversation (id) ON DELETE CASCADE,
    last_message_id  BIGINT      NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL,
    expires_at       TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_shared_conversation_expires ON shared_conversation (expires_at);
