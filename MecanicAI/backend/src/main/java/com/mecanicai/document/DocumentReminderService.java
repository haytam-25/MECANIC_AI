package com.mecanicai.document;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.Period;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.mecanicai.config.AppProperties;
import com.mecanicai.document.ReminderEmail.Reminder;
import com.mecanicai.mail.Mailer;

/**
 * Avisos por email de la ITV y el seguro: con el aviso activado, desde dos meses antes de que caduque se manda uno
 * cada semana hasta el día en que caduca. Se revisa una vez al día; si un día falla el envío (o el servidor estaba
 * parado), se manda al siguiente.
 */
@Service
public class DocumentReminderService {

	private static final Logger log = LoggerFactory.getLogger(DocumentReminderService.class);

	/** Cuánto antes de caducar empiezan los avisos. */
	static final Period NOTICE = Period.ofMonths(2);

	/** Días entre un aviso y el siguiente. */
	static final int EVERY_DAYS = 7;

	/**
	 * Qué secciones toca avisar un día: las que caducan entre {@code from} y {@code until} y no se avisaron después
	 * de {@code remindedBefore}.
	 */
	record Window(LocalDate from, LocalDate until, LocalDate remindedBefore) {

		static Window on(LocalDate today) {
			return new Window(today, today.plus(NOTICE), today.minusDays(EVERY_DAYS));
		}

		boolean isDue(LocalDate expiresOn, LocalDate lastReminded) {
			return !expiresOn.isBefore(from) && !expiresOn.isAfter(until)
					&& (lastReminded == null || !lastReminded.isAfter(remindedBefore));
		}
	}

	private final JdbcClient jdbc;

	private final Mailer mailer;

	private final AppProperties props;

	public DocumentReminderService(JdbcClient jdbc, Mailer mailer, AppProperties props) {
		this.jdbc = jdbc;
		this.mailer = mailer;
		this.props = props;
	}

	@Scheduled(cron = "0 0 10 * * *", zone = "${app.timezone:Europe/Madrid}")
	public void sendDue() {
		sendDue(LocalDate.now(props.timezone()));
	}

	/** Manda los avisos que tocan hoy; devuelve cuántos se enviaron. */
	int sendDue(LocalDate today) {
		Window window = Window.on(today);
		List<Reminder> due = jdbc.sql("""
				SELECT s.id, s.kind, s.expires_on, s.vehicle_id, u.email, u.name, v.brand, v.model, v.plate
				FROM document_section s
				JOIN app_user u ON u.id = s.user_id
				JOIN vehicle v ON v.id = s.vehicle_id
				WHERE s.reminder AND s.kind IN ('INSPECTION', 'INSURANCE')
				AND s.expires_on BETWEEN :from AND :until
				AND (s.last_reminded_on IS NULL OR s.last_reminded_on <= :remindedBefore)
				ORDER BY s.expires_on""")
			.param("from", window.from())
			.param("until", window.until())
			.param("remindedBefore", window.remindedBefore())
			.query(DocumentReminderService::map)
			.list();

		int sent = 0;
		for (Reminder reminder : due) {
			try {
				mailer.send(ReminderEmail.build(reminder, today, props.publicUrl()));
			}
			catch (RuntimeException ex) {
				log.warn("No se pudo enviar el aviso de la sección {}: {}", reminder.sectionId(), ex.getMessage());
				continue;
			}
			jdbc.sql("UPDATE document_section SET last_reminded_on = :today WHERE id = :id")
				.param("today", today)
				.param("id", reminder.sectionId())
				.update();
			sent++;
		}
		if (!due.isEmpty()) {
			log.info("Avisos de documentación: {} enviados de {}", sent, due.size());
		}
		return sent;
	}

	private static Reminder map(ResultSet rs, int row) throws SQLException {
		return new Reminder(rs.getObject("id", UUID.class), DocumentKind.valueOf(rs.getString("kind")),
				rs.getObject("expires_on", LocalDate.class), rs.getObject("vehicle_id", UUID.class),
				rs.getString("email"), rs.getString("name"), rs.getString("brand"), rs.getString("model"),
				rs.getString("plate"));
	}

}
