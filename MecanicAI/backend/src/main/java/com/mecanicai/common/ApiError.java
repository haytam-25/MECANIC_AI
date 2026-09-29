package com.mecanicai.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.mecanicai.usage.Usage;

/**
 * Cuerpo JSON de todas las respuestas de error de la API.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(String code, String message, Usage usage) {

	public ApiError(String code, String message) {
		this(code, message, null);
	}

}
