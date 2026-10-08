package com.mecanicai.usage;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.mecanicai.common.AppException;
import com.mecanicai.config.AppProperties;

/**
 * Límites de uso diarios (mensajes a la IA por usuario, invitado o IP).
 * <p>
 * El incremento es atómico en PostgreSQL ({@code INSERT ... ON CONFLICT ... WHERE count < limit}), así que
 * dos peticiones simultáneas nunca pueden superar el límite.
 */
@Service
public class UsageService {

	private static final Logger log = LoggerFactory.getLogger(UsageService.class);

	private final JdbcClient jdbc;

	private final ZoneId zone;

	public UsageService(JdbcClient jdbc, AppProperties props) {
		this.jdbc = jdbc;
		this.zone = props.timezone();
	}

	/** Una unidad de uso consumida; se puede devolver con {@link #refund(Reservation)} si la IA falla. */
	public record Reservation(String subject, LocalDate day, Usage usage) {
	}

	/** Todos los invitados juntos (cupo diario global de mensajes del modo invitado). */
	public static final String ALL_GUESTS = "guest:all";

	public static String userSubject(Object userId) {
		return "user:" + userId;
	}

	public static String guestSubject(String guestId) {
		return "guest:" + guestId;
	}

	/** Conexión del invitado: la IPv4, o el bloque /64 de una IPv6 (ver {@link ClientNetwork}). */
	public static String ipSubject(String remoteAddr) {
		return "ip:" + ClientNetwork.of(remoteAddr);
	}

	/**
	 * Consume una unidad o lanza 429 si ya se alcanzó el límite de hoy.
	 */
	public Reservation consume(String subject, int limit, String limitMessage) {
		return consume(subject, today(), resetsAt(), limit, limitMessage);
	}

	/**
	 * Como {@link #consume}, pero el límite es por semana (de lunes a domingo). Se cuenta en la misma tabla, con el
	 * lunes de la semana como fecha.
	 */
	public Reservation consumeWeekly(String subject, int limit, String limitMessage) {
		return consume(subject, weekStart(), weekResetsAt(), limit, limitMessage);
	}

	private Reservation consume(String subject, LocalDate day, OffsetDateTime resetsAt, int limit,
			String limitMessage) {
		Optional<Integer> count = limit <= 0 ? Optional.empty() : jdbc.sql("""
				INSERT INTO usage_counter (subject, day, count) VALUES (:subject, :day, 1)
				ON CONFLICT (subject, day) DO UPDATE SET count = usage_counter.count + 1
				WHERE usage_counter.count < :limit
				RETURNING count""")
			.param("subject", subject)
			.param("day", day)
			.param("limit", limit)
			.query(Integer.class)
			.optional();
		if (count.isEmpty()) {
			throw AppException.quotaExceeded(Usage.of(limit, limit, resetsAt), limitMessage);
		}
		return new Reservation(subject, day, Usage.of(count.get(), limit, resetsAt));
	}

	/** Devuelve la unidad consumida (por ejemplo, si la IA no llegó a responder). */
	public void refund(Reservation reservation) {
		jdbc.sql("UPDATE usage_counter SET count = count - 1 WHERE subject = :subject AND day = :day AND count > 0")
			.param("subject", reservation.subject())
			.param("day", reservation.day())
			.update();
	}

	/** Uso de hoy sin consumir nada. */
	public Usage peek(String subject, int limit) {
		return Usage.of(count(subject, today()), limit, resetsAt());
	}

	/** Uso de esta semana sin consumir nada. */
	public Usage peekWeekly(String subject, int limit) {
		return Usage.of(count(subject, weekStart()), limit, weekResetsAt());
	}

	private int count(String subject, LocalDate day) {
		return jdbc.sql("SELECT count FROM usage_counter WHERE subject = :subject AND day = :day")
			.param("subject", subject)
			.param("day", day)
			.query(Integer.class)
			.optional()
			.orElse(0);
	}

	public LocalDate today() {
		return LocalDate.now(zone);
	}

	public OffsetDateTime resetsAt() {
		return today().plusDays(1).atStartOfDay(zone).toOffsetDateTime();
	}

	/** Lunes de esta semana. */
	public LocalDate weekStart() {
		return today().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
	}

	/** El lunes que viene a las 00:00. */
	public OffsetDateTime weekResetsAt() {
		return weekStart().plusWeeks(1).atStartOfDay(zone).toOffsetDateTime();
	}

	/** Limpieza diaria de contadores antiguos (los semanales llevan el lunes de esta semana: nunca más de 6 días). */
	@Scheduled(cron = "0 30 4 * * *", zone = "${app.timezone:Europe/Madrid}")
	public void purgeOldCounters() {
		int deleted = jdbc.sql("DELETE FROM usage_counter WHERE day < :limitDay")
			.param("limitDay", today().minusDays(7))
			.update();
		log.info("Contadores de uso antiguos eliminados: {}", deleted);
	}

}
