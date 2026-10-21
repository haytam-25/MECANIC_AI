-- Inicios de sesión cerrados ("Cerrar sesión"). El JWT por sí solo valdría hasta caducar: el backend comprueba en cada
-- petición que su sesión (claim "sid", se mantiene al renovar el token) no está aquí. expires_at: cuándo caduca el
-- último token que pudo emitirse en esa sesión; a partir de entonces la fila ya no hace falta y se borra cada día.
CREATE TABLE revoked_session (
    session_id  UUID        PRIMARY KEY,
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_revoked_session_expires ON revoked_session (expires_at);
