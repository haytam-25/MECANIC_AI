package com.mecanicai;

import java.time.Duration;
import java.time.ZoneId;
import java.util.List;

import com.mecanicai.config.AppProperties;

/**
 * Configuración por defecto para los tests unitarios.
 */
public final class TestProps {

	private TestProps() {
	}

	public static AppProperties defaults() {
		return new AppProperties(ZoneId.of("Europe/Madrid"), "/",
				new AppProperties.Auth("test-secret-0123456789-0123456789-abcdef", 7, false,
						new AppProperties.Google(null, null)),
				new AppProperties.Ai("mock", new AppProperties.Gemini(null, Duration.ofSeconds(30)),
						new AppProperties.Chat(0.4f, 4096, 20),
						new AppProperties.Engines(List.of("gemini-3.6-flash"), "low", Duration.ofSeconds(30), 40, 300)),
				new AppProperties.Plans(new AppProperties.PlanSettings(List.of("gemini-3.6-flash"), "low", 20, 5),
						new AppProperties.PlanSettings(List.of("gemini-3.8-flash"), "medium", 300, 30)),
				new AppProperties.Guest(5, 20, 2, 6, 300), new AppProperties.Limits(5, 20, 20, 6, 10));
	}

}
