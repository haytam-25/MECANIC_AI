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
		// La consulta solo preselecciona las que caducan pronto (con el índice de los avisos); cuáles tocan hoy lo
		// decide Window.isDue
		List<Reminder> due = jdbc.sql("""
				SELECT s.id, s.kind, s.expires_on, s.last_reminded_on, s.vehicle_id, u.email, u.name, v.brand, v.model,
					v.plate
				FROM document_section s
				JOIN app_user u ON u.id = s.user_id
				JOIN vehicle v ON v.id = s.vehicle_id
				WHERE s.reminder AND s.kind IN ('INSPECTION', 'INSURANCE')
				AND s.expires_on BETWEEN :from AND :until
				ORDER BY s.expires_on""")
			.param("from", window.from())
			.param("until", window.until())
			.query(DocumentReminderService::map)
			.list()
			.stream()
			.filter(candidate -> window.isDue(candidate.reminder().expiresOn(), candidate.lastReminded()))
			.map(Candidate::reminder)
			.toList();

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

	/** Sección con aviso que caduca pronto y el día de su último aviso (null si aún no se ha mandado ninguno). */
	private record Candidate(Reminder reminder, LocalDate lastReminded) {
	}

	private static Candidate map(ResultSet rs, int row) throws SQLException {
		Reminder reminder = new Reminder(rs.getObject("id", UUID.class), DocumentKind.valueOf(rs.getString("kind")),
				rs.getObject("expires_on", LocalDate.class), rs.getObject("vehicle_id", UUID.class),
				rs.getString("email"), rs.getString("name"), rs.getString("brand"), rs.getString("model"),
				rs.getString("plate"));
		return new Candidate(reminder, rs.getObject("last_reminded_on", LocalDate.class));
	}

}
