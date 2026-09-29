package com.mecanicai.ai;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Petición de una respuesta estructurada en JSON (se usa para sugerir motorizaciones), con los modelos en orden
 * de preferencia.
 * {@code timeout} es opcional: si es null se usa el tiempo máximo general del cliente.
 */
public record AiJsonRequest(List<String> models, String thinkingLevel, String systemPrompt, String userPrompt,
		Map<String, Object> jsonSchema, Duration timeout) {
}
