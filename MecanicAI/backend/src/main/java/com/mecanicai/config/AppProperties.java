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
		@DefaultValue Guest guest,
		@DefaultValue Limits limits) {

	public record Auth(
			String jwtSecret,
			@DefaultValue("30") int sessionDays,
			@DefaultValue("true") boolean cookieSecure,
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
			@DefaultValue("40") int dailyLookupsPerClient,
			@DefaultValue("300") int guestDailyLookupsTotal) {
	}

	public record Plans(@DefaultValue PlanSettings free, @DefaultValue PlanSettings pro) {

		public PlanSettings of(Plan plan) {
			return switch (plan) {
				case FREE -> free;
				case PRO -> pro;
			};
		}
	}

	/** Modelos de IA (en orden de preferencia), límite diario de mensajes y semanal de informes médicos de cada plan. */
	public record PlanSettings(
			@DefaultValue("gemini-3.6-flash") List<String> models,
			String thinkingLevel,
			@DefaultValue("20") int dailyMessages,
			@DefaultValue("20") int weeklyReports) {
	}

	/**
	 * Límites del modo invitado. {@code dailyMessagesPerIp} y {@code dailyReportsPerIp}: freno extra por si alguien
	 * borra la cookie de invitado para saltarse el límite. {@code dailyMessagesTotal}: entre todos los invitados, para
	 * que nadie pueda gastar la cuota de Gemini que comparten también los usuarios con cuenta.
	 */
	public record Guest(
			@DefaultValue("5") int dailyMessages,
			@DefaultValue("20") int dailyMessagesPerIp,
			@DefaultValue("3") int dailyReports,
			@DefaultValue("10") int dailyReportsPerIp,
			@DefaultValue("300") int dailyMessagesTotal) {
	}

	/**
	 * Topes para que nadie llene la base de datos ni gaste la IA a ráfagas. {@code maxConversations}: al empezar una
	 * más se borra la más antigua. {@code maxMessagesPerConversation}: preguntas y respuestas de una consulta (llena,
	 * hay que empezar otra). {@code maxRepairs}: reparaciones del diario entre todos los coches.
	 * {@code maxBasketItems}: artículos de la cesta entre todos los coches. {@code chatPerMinute} y
	 * {@code lookupsPerMinute}: mensajes y consultas a la IA (motorizaciones, plan de mantenimiento) por usuario o
	 * conexión y minuto. {@code guestReportsPerMinute}: informes médicos de invitado por conexión y minuto.
	 */
	public record Limits(
			@DefaultValue("5") int maxVehicles,
			@DefaultValue("20") int maxConversations,
			@DefaultValue("100") int maxMessagesPerConversation,
			@DefaultValue("30") int maxRepairs,
			@DefaultValue("30") int maxBasketItems,
			@DefaultValue("20") int dailyImports,
			@DefaultValue("6") int chatPerMinute,
			@DefaultValue("10") int lookupsPerMinute,
			@DefaultValue("6") int guestReportsPerMinute) {
	}

}
