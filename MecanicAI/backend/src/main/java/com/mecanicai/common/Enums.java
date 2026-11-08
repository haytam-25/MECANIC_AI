package com.mecanicai.common;

import java.util.Locale;
import java.util.Optional;

/** Para leer valores de enums que llegan como texto (del navegador o de la IA). */
public final class Enums {

	private Enums() {
	}

	/** El valor con ese nombre, sin distinguir mayúsculas ni espacios alrededor; vacío si no hay ninguno. */
	public static <E extends Enum<E>> Optional<E> parse(Class<E> type, String raw) {
		if (raw == null || raw.isBlank()) {
			return Optional.empty();
		}
		try {
			return Optional.of(Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT)));
		}
		catch (IllegalArgumentException ex) {
			return Optional.empty();
		}
	}

}
