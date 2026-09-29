package com.mecanicai.auth;

import java.time.Instant;
import java.util.UUID;

/**
 * Usuario autenticado de la petición actual (se obtiene con {@code @AuthenticationPrincipal}).
 */
public record AuthUser(UUID id, Instant issuedAt) {
}
