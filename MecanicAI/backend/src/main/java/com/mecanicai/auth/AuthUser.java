package com.mecanicai.auth;

import java.time.Instant;
import java.util.UUID;

/**
 * Usuario autenticado de la petición actual (se obtiene con {@code @AuthenticationPrincipal}). {@code sessionId}: el
 * inicio de sesión del que viene el token (se mantiene al renovarlo y se revoca al cerrar sesión); null en los tokens
 * emitidos antes de que existiera.
 */
public record AuthUser(UUID id, UUID sessionId, Instant issuedAt) {
}
