package com.mecanicai.config;

import java.time.Duration;
import java.time.ZoneId;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.StringUtils;

import com.mecanicai.user.Plan;

/**
 * Configuración propia de MecanicAI (prefijo {@code app} en application.yml).
 */
@ConfigurationProperties("app")
public record AppProperties(
		@DefaultValue("Europe/Madrid") ZoneId timezone,
		@DefaultValue("/") String frontendUrl,
		@DefaultValue Auth auth,
		@DefaultValue Ai ai,
		@DefaultValue Plans plans,
		@DefaultValue Guest guest) {

	public record Auth(
			String jwtSecret,
			@DefaultValue("30") int sessionDays,
			@DefaultValue("true") boolean cookieSecure,
			boolean devLoginEnabled,
			@DefaultValue Google google) {
	}

	public record Google(String clientId, String clientSecret) {

		public boolean configured() {
			return StringUtils.hasText(clientId) && StringUtils.hasText(clientSecret);
		}
	}

	public record Ai(
			@DefaultValue("gemini") String provider,
			@DefaultValue Gemini gemini,
			@DefaultValue Chat chat,
			@DefaultValue Engines engines) {
	}

	public record Gemini(String apiKey, @DefaultValue("90s") Duration timeout) {
	}

	public record Chat(
			@DefaultValue("0.4") float temperature,
			@DefaultValue("4096") int maxOutputTokens,
			@DefaultValue("20") int historyMessages) {
	}

	public record Engines(
			@DefaultValue("gemini-3.6-flash") List<String> models,
			String thinkingLevel,
			@DefaultValue("30s") Duration timeout,
			@DefaultValue("40") int dailyLookupsPerClient) {
	}

	public record Plans(@DefaultValue PlanSettings free, @DefaultValue PlanSettings pro) {

		public PlanSettings of(Plan plan) {
			return switch (plan) {
				case FREE -> free;
				case PRO -> pro;
			};
		}
	}

	/** Modelos de IA (en orden de preferencia) y límite diario de mensajes de cada plan. */
	public record PlanSettings(
			@DefaultValue("gemini-3.6-flash") List<String> models,
			String thinkingLevel,
			@DefaultValue("30") int dailyMessages) {
	}

	public record Guest(
			@DefaultValue("5") int dailyMessages,
			@DefaultValue("20") int dailyMessagesPerIp) {
	}

}
