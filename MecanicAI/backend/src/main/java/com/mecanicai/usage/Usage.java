package com.mecanicai.usage;

import java.time.OffsetDateTime;

/**
 * Uso diario de mensajes que se muestra al usuario ("te quedan X mensajes hoy").
 */
public record Usage(int used, int limit, int remaining, OffsetDateTime resetsAt) {

	public static Usage of(int used, int limit, OffsetDateTime resetsAt) {
		int clampedUsed = Math.min(Math.max(used, 0), Math.max(limit, 0));
		return new Usage(clampedUsed, limit, Math.max(limit - clampedUsed, 0), resetsAt);
	}

}
