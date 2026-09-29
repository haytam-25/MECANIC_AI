package com.mecanicai.ai;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import com.mecanicai.config.AppProperties;

@Configuration
public class AiConfig {

	private static final Logger log = LoggerFactory.getLogger(AiConfig.class);

	/**
	 * Elige el proveedor según {@code app.ai.provider}: gemini (exige API key), mock (demo) o auto (gemini si hay
	 * API key; si no, demo). En producción se usa "gemini" para que la app no arranque mal configurada.
	 */
	@Bean
	AiClient aiClient(AppProperties props) {
		AppProperties.Gemini gemini = props.ai().gemini();
		boolean hasKey = StringUtils.hasText(gemini.apiKey());
		String provider = props.ai().provider().trim().toLowerCase(Locale.ROOT);
		return switch (provider) {
			case "gemini" -> {
				if (!hasKey) {
					throw new IllegalStateException("Falta GEMINI_API_KEY (app.ai.gemini.api-key). "
							+ "Consíguela gratis en https://aistudio.google.com/apikey");
				}
				yield new GeminiAiClient(gemini.apiKey(), gemini.timeout());
			}
			case "auto" -> hasKey ? new GeminiAiClient(gemini.apiKey(), gemini.timeout()) : demo();
			case "mock" -> demo();
			default -> throw new IllegalStateException("app.ai.provider desconocido: " + provider);
		};
	}

	private static AiClient demo() {
		log.warn("IA en MODO DEMO (sin GEMINI_API_KEY): las respuestas son de ejemplo");
		return new MockAiClient();
	}

}
